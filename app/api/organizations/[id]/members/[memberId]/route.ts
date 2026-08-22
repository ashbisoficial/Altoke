import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission } from "@/lib/permissions";

const updateMembershipSchema = z.object({
  roleId: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId, memberId } = await params;

  if (!(await hasOrgPermission(user.id, organizationId, "member.manage"))) return forbidden();

  const membership = await prisma.membership.findFirst({
    where: { id: memberId, organizationId },
  });
  if (!membership) return notFound("Miembro");

  const parsed = updateMembershipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const role = await prisma.role.findFirst({ where: { id: parsed.data.roleId, organizationId } });
  if (!role) return errorResponse(400, "Rol inválido para esta organización");

  const updated = await prisma.membership.update({
    where: { id: memberId },
    data: { roleId: role.id },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, role: true },
  });

  return NextResponse.json({ membership: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId, memberId } = await params;

  if (!(await hasOrgPermission(user.id, organizationId, "member.manage"))) return forbidden();

  const membership = await prisma.membership.findFirst({ where: { id: memberId, organizationId } });
  if (!membership) return notFound("Miembro");

  const adminCount = await prisma.membership.count({
    where: { organizationId, role: { name: "Admin" } },
  });
  if (membership.roleId && adminCount <= 1) {
    const role = await prisma.role.findUnique({ where: { id: membership.roleId } });
    if (role?.name === "Admin") {
      return errorResponse(409, "No puedes quitar al último administrador de la organización");
    }
  }

  await prisma.membership.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
