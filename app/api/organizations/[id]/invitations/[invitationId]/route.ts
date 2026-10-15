import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasOrgPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId, invitationId } = await params;

  if (!(await hasOrgPermission(user.id, organizationId, "member.manage"))) return forbidden();

  const ref = adminDb.doc(`invitations/${invitationId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.organizationId !== organizationId) return notFound("Invitación");

  await ref.update({ status: "REVOKED" });
  return NextResponse.json({ ok: true });
}
