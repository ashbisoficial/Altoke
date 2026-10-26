import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { syncUserClaims } from "@/lib/firebase/claims";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";
import { DEFAULT_ISSUE_TYPES, DEFAULT_WORKFLOW_STATUSES, DEFAULT_WORKFLOW_TRANSITIONS } from "@/lib/seed-defaults";

const createProjectSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  key: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "La key debe ser mayúsculas y números, ej. PROJ"),
  description: z.string().trim().max(2000).optional(),
});

/** Builds the embedded workflow object (statuses + transitions) for a brand-new project. */
function buildDefaultWorkflow(name: string) {
  const statusIdByName = new Map<string, string>();
  const statuses = DEFAULT_WORKFLOW_STATUSES.map((s) => {
    const id = crypto.randomUUID();
    statusIdByName.set(s.name, id);
    return { id, ...s, isInitial: s.isInitial ?? false };
  });
  const transitions = DEFAULT_WORKFLOW_TRANSITIONS.map((t) => ({
    id: crypto.randomUUID(),
    name: t.name,
    fromStatusId: statusIdByName.get(t.from)!,
    toStatusId: statusIdByName.get(t.to)!,
  }));
  return { name, statuses, transitions, initialStatusId: statusIdByName.get("Por hacer")! };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const organizationId = request.nextUrl.searchParams.get("organizationId");

  const membershipDocs = await adminDb
    .collectionGroup("memberships")
    .where("userId", "==", user.id)
    .get();
  const memberOrgIds = new Set(
    membershipDocs.docs.map((doc) => doc.ref.parent.parent?.id).filter((id): id is string => Boolean(id)),
  );

  if (organizationId && !memberOrgIds.has(organizationId)) return NextResponse.json({ projects: [] });

  let query = adminDb.collection("projects") as FirebaseFirestore.Query;
  query = organizationId
    ? query.where("organizationId", "==", organizationId)
    : memberOrgIds.size > 0
      ? query.where("organizationId", "in", [...memberOrgIds].slice(0, 30))
      : query.where("organizationId", "==", "__none__");

  const snaps = await query.get();
  const orgIds = [...new Set(snaps.docs.map((d) => d.data().organizationId as string))];
  const orgSnaps = orgIds.length
    ? await adminDb.getAll(...orgIds.map((id) => adminDb.doc(`organizations/${id}`)))
    : [];
  const orgById = new Map(orgSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const projects = await Promise.all(
    snaps.docs.map(async (doc) => {
      const data = doc.data();
      const [issueCount, memberCount] = await Promise.all([
        adminDb.collection("issues").where("projectId", "==", doc.id).count().get(),
        adminDb.collection(`projects/${doc.id}/members`).count().get(),
      ]);
      const org = orgById.get(data.organizationId);
      return {
        id: doc.id,
        name: data.name,
        key: data.key,
        description: data.description ?? null,
        createdAt: tsToISO(data.createdAt),
        organization: org ? { id: data.organizationId, name: org.name, slug: org.slug } : null,
        _count: { issues: issueCount.data().count, members: memberCount.data().count },
      };
    }),
  );
  projects.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { organizationId, name, description } = parsed.data;
  const key = parsed.data.key.toUpperCase();

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();
  if (!(await hasOrgPermission(user.id, organizationId, "project.create"))) return forbidden();

  const existing = await adminDb
    .collection("projects")
    .where("organizationId", "==", organizationId)
    .where("key", "==", key)
    .limit(1)
    .get();
  if (!existing.empty) return errorResponse(409, "Ya existe un proyecto con esa key en esta organización");

  const membershipSnap = await adminDb.doc(`organizations/${organizationId}/memberships/${user.id}`).get();
  if (!membershipSnap.exists) return notFound("Membresía");
  const role = membershipSnap.data()!.role as string;

  const projectRef = adminDb.collection("projects").doc();
  const workflow = buildDefaultWorkflow(`Flujo de ${name}`);

  const batch = adminDb.batch();
  batch.set(projectRef, {
    organizationId,
    name,
    key,
    description: description ?? null,
    issueCounter: 0,
    workflow,
    createdAt: FieldValue.serverTimestamp(),
  });
  for (const issueType of DEFAULT_ISSUE_TYPES) {
    batch.set(projectRef.collection("issueTypes").doc(), issueType);
  }
  batch.set(adminDb.collection("boards").doc(), {
    projectId: projectRef.id,
    name: "Tablero principal",
    type: "MURAL",
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(projectRef.collection("members").doc(user.id), {
    userId: user.id,
    role,
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  await syncUserClaims(user.id).catch((e) => console.error("syncUserClaims failed", e));

  return NextResponse.json(
    { project: { id: projectRef.id, organizationId, name, key, description: description ?? null } },
    { status: 201 },
  );
}
