import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, organizationId },
  });
  if (!invitation) return notFound("Invitación");

  await prisma.invitation.update({ where: { id: invitationId }, data: { status: "REVOKED" } });
  return NextResponse.json({ ok: true });
}
