import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await isProjectMember(user.id, id))) return forbidden();

  const projectRef = adminDb.doc(`projects/${id}`);
  const [projectSnap, issueTypesSnap, labelsSnap, componentsSnap, boardsSnap, sprintsSnap, membersSnap] =
    await Promise.all([
      projectRef.get(),
      projectRef.collection("issueTypes").get(),
      projectRef.collection("labels").get(),
      projectRef.collection("components").get(),
      projectRef.collection("boards").get(),
      projectRef.collection("sprints").orderBy("createdAt", "desc").get(),
      projectRef.collection("members").get(),
    ]);
  if (!projectSnap.exists) return notFound("Proyecto");
  const data = projectSnap.data()!;

  const [org, memberUsers] = await Promise.all([
    adminDb.doc(`organizations/${data.organizationId}`).get(),
    membersSnap.docs.length
      ? adminDb.getAll(...membersSnap.docs.map((d) => adminDb.doc(`users/${d.id}`)))
      : Promise.resolve([]),
  ]);
  const userById = new Map(memberUsers.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const project = {
    id: projectSnap.id,
    name: data.name,
    key: data.key,
    description: data.description ?? null,
    organizationId: data.organizationId,
    organization: org.exists ? { id: org.id, name: org.data()!.name, slug: org.data()!.slug } : null,
    issueTypes: issueTypesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    labels: labelsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    components: componentsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    boards: boardsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    sprints: sprintsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      startDate: tsToISO(d.data().startDate),
      endDate: tsToISO(d.data().endDate),
      createdAt: tsToISO(d.data().createdAt),
    })),
    members: membersSnap.docs.map((d) => {
      const u = userById.get(d.id);
      return {
        id: d.id,
        role: { id: d.data().role, name: d.data().role },
        user: u ? { id: d.id, name: u.name ?? null, email: u.email, avatarUrl: u.avatarUrl ?? null } : null,
      };
    }),
    workflow: {
      statuses: [...(data.workflow?.statuses ?? [])].sort((a, b) => a.order - b.order),
      transitions: data.workflow?.transitions ?? [],
    },
  };

  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await hasProjectPermission(user.id, id, "project.manage"))) return forbidden();

  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = adminDb.doc(`projects/${id}`);
  const existing = await ref.get();
  if (!existing.exists) return notFound("Proyecto");

  await ref.update(parsed.data);
  const updated = await ref.get();
  const data = updated.data()!;
  return NextResponse.json({
    project: { id: updated.id, ...data, createdAt: tsToISO(data.createdAt) },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await hasProjectPermission(user.id, id, "project.delete"))) return forbidden();

  const ref = adminDb.doc(`projects/${id}`);
  const existing = await ref.get();
  if (!existing.exists) return notFound("Proyecto");

  await ref.delete();
  return NextResponse.json({ ok: true });
}
