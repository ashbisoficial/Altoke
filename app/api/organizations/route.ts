import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { syncUserClaims } from "@/lib/firebase/claims";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, unauthorized, zodErrorResponse } from "@/lib/http";

const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Usa solo minúsculas, números y guiones"),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const membershipDocs = await adminDb
    .collectionGroup("memberships")
    .where("userId", "==", user.id)
    .get();

  const orgIds = membershipDocs.docs
    .map((doc) => doc.ref.parent.parent?.id)
    .filter((id): id is string => Boolean(id));
  if (orgIds.length === 0) return NextResponse.json({ organizations: [] });

  const orgSnaps = await adminDb.getAll(...orgIds.map((id) => adminDb.doc(`organizations/${id}`)));

  const organizations = await Promise.all(
    orgSnaps
      .filter((snap) => snap.exists)
      .map(async (snap) => {
        const [projectCount, memberCount] = await Promise.all([
          adminDb.collection("projects").where("organizationId", "==", snap.id).count().get(),
          adminDb.collection(`organizations/${snap.id}/memberships`).count().get(),
        ]);
        const data = snap.data()!;
        return {
          id: snap.id,
          name: data.name,
          slug: data.slug,
          createdAt: tsToISO(data.createdAt),
          _count: { projects: projectCount.data().count, memberships: memberCount.data().count },
        };
      }),
  );
  organizations.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ organizations });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createOrgSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { name, slug } = parsed.data;

  const existing = await adminDb.collection("organizations").where("slug", "==", slug).limit(1).get();
  if (!existing.empty) return errorResponse(409, "Ese slug ya está en uso");

  const orgRef = adminDb.collection("organizations").doc();
  const batch = adminDb.batch();
  batch.set(orgRef, { name, slug, createdAt: FieldValue.serverTimestamp() });
  batch.set(orgRef.collection("memberships").doc(user.id), {
    userId: user.id,
    role: "Admin",
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  await syncUserClaims(user.id).catch(() => {});

  return NextResponse.json({ organization: { id: orgRef.id, name, slug } }, { status: 201 });
}
