import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { syncUserClaims } from "@/lib/firebase/claims";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";

const updateMemberSchema = z.object({
  roleId: z.enum(Object.keys(DEFAULT_ROLES) as [string, ...string[]]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId, memberId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "member.manage"))) return forbidden();

  const ref = adminDb.doc(`projects/${projectId}/members/${memberId}`);
  const existing = await ref.get();
  if (!existing.exists) return notFound("Miembro");

  const parsed = updateMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await ref.update({ role: parsed.data.roleId });
  await syncUserClaims(memberId).catch(() => {});

  const userSnap = await adminDb.doc(`users/${memberId}`).get();
  const u = userSnap.data();
  return NextResponse.json({
    member: {
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
  const { id: projectId, memberId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "member.manage"))) return forbidden();

  const ref = adminDb.doc(`projects/${projectId}/members/${memberId}`);
  const existing = await ref.get();
  if (!existing.exists) return notFound("Miembro");

  await ref.delete();
  await syncUserClaims(memberId).catch(() => {});
  return NextResponse.json({ ok: true });
}
