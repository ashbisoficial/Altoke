import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, notFound, unauthorized } from "@/lib/http";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation) return notFound("Invitación");
  if (invitation.status === "REVOKED") return errorResponse(410, "Esta invitación fue cancelada");
  if (invitation.status === "ACCEPTED") return errorResponse(410, "Esta invitación ya fue usada");
  if (invitation.expiresAt < new Date()) return errorResponse(410, "Esta invitación ya expiró");

  const result = await prisma.$transaction(async (tx) => {
    await tx.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: invitation.organizationId } },
      create: { userId: user.id, organizationId: invitation.organizationId, roleId: invitation.orgRoleId },
      update: {},
    });

    if (invitation.projectId && invitation.projectRoleId) {
      await tx.projectMember.upsert({
        where: { userId_projectId: { userId: user.id, projectId: invitation.projectId } },
        create: { userId: user.id, projectId: invitation.projectId, roleId: invitation.projectRoleId },
        update: {},
      });
    }

    return tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  });

  return NextResponse.json({
    invitation: result,
    redirectTo: invitation.projectId ? `/board?projectId=${invitation.projectId}` : "/dashboard",
  });
}
