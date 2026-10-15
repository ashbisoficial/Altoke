import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { syncUserClaims } from "@/lib/firebase/claims";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";

const addMemberSchema = z.object({
  email: z.string().trim().email(),
  roleId: z.enum(Object.keys(DEFAULT_ROLES) as [string, ...string[]]),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();

  const membershipsSnap = await adminDb
    .collection(`organizations/${organizationId}/memberships`)
    .orderBy("createdAt", "asc")
    .get();

  const userSnaps = membershipsSnap.docs.length
    ? await adminDb.getAll(...membershipsSnap.docs.map((d) => adminDb.doc(`users/${d.id}`)))
    : [];
  const userById = new Map(userSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const members = membershipsSnap.docs.map((d) => {
    const u = userById.get(d.id);
    const role = d.data().role as string;
    return {
      id: d.id,
      role: { id: role, name: role },
      user: { id: d.id, name: u?.name ?? null, email: u?.email ?? "", avatarUrl: u?.avatarUrl ?? null },
    };
  });

  return NextResponse.json({ members });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await hasOrgPermission(user.id, organizationId, "member.manage"))) return forbidden();

  const parsed = addMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { email, roleId: role } = parsed.data;

  const targetSnap = await adminDb.collection("users").where("email", "==", email).limit(1).get();
  if (targetSnap.empty) {
    return errorResponse(404, "Ese correo todavía no tiene una cuenta en Altoke. Pídele que se registre primero.");
  }
  const targetUserId = targetSnap.docs[0].id;
  const targetUser = targetSnap.docs[0].data();

  const membershipRef = adminDb.doc(`organizations/${organizationId}/memberships/${targetUserId}`);
  const existing = await membershipRef.get();
  if (existing.exists) return errorResponse(409, "Ese usuario ya es miembro de la organización");

  await membershipRef.set({ userId: targetUserId, role, createdAt: FieldValue.serverTimestamp() });
  await syncUserClaims(targetUserId).catch(() => {});

  return NextResponse.json(
    {
      membership: {
        id: targetUserId,
        role: { id: role, name: role },
        user: { id: targetUserId, name: targetUser.name ?? null, email: targetUser.email, avatarUrl: targetUser.avatarUrl ?? null },
      },
    },
    { status: 201 },
  );
}
