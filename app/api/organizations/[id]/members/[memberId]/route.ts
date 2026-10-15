import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { syncUserClaims } from "@/lib/firebase/claims";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission } from "@/lib/permissions";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";

const updateMembershipSchema = z.object({
  roleId: z.enum(Object.keys(DEFAULT_ROLES) as [string, ...string[]]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId, memberId } = await params;

  if (!(await hasOrgPermission(user.id, organizationId, "member.manage"))) return forbidden();

  const ref = adminDb.doc(`organizations/${organizationId}/memberships/${memberId}`);
  const existing = await ref.get();
  if (!existing.exists) return notFound("Miembro");

  const parsed = updateMembershipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await ref.update({ role: parsed.data.roleId });
  await syncUserClaims(memberId).catch(() => {});

  const userSnap = await adminDb.doc(`users/${memberId}`).get();
  const u = userSnap.data();
  return NextResponse.json({
    membership: {
      id: memberId,
      role: { id: parsed.data.roleId, name: parsed.data.roleId },
      user: { id: memberId, name: u?.name ?? null, email: u?.email ?? "", avatarUrl: u?.avatarUrl ?? null },
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId, memberId } = await params;

  if (!(await hasOrgPermission(user.id, organizationId, "member.manage"))) return forbidden();

  const ref = adminDb.doc(`organizations/${organizationId}/memberships/${memberId}`);
  const existing = await ref.get();
  if (!existing.exists) return notFound("Miembro");

  if (existing.data()!.role === "Admin") {
    const adminCount = await adminDb
      .collection(`organizations/${organizationId}/memberships`)
      .where("role", "==", "Admin")
      .count()
      .get();
    if (adminCount.data().count <= 1) {
      return errorResponse(409, "No puedes quitar al último administrador de la organización");
    }
  }

  await ref.delete();
  await syncUserClaims(memberId).catch(() => {});
  return NextResponse.json({ ok: true });
}
