import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateMemberSchema = z.object({
  roleId: z.string().min(1),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId, memberId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "member.manage"))) return forbidden();

  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    include: { project: true },
  });
  if (!member) return notFound("Miembro");

  const parsed = updateMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const role = await prisma.role.findFirst({
    where: { id: parsed.data.roleId, organizationId: member.project.organizationId },
  });
  if (!role) return errorResponse(400, "Rol inválido para esta organización");

  const updated = await prisma.projectMember.update({
    where: { id: memberId },
    data: { roleId: role.id },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, role: true },
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId, memberId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "member.manage"))) return forbidden();

  const member = await prisma.projectMember.findFirst({ where: { id: memberId, projectId } });
  if (!member) return notFound("Miembro");

  await prisma.projectMember.delete({ where: { id: memberId } });
  return NextResponse.json({ ok: true });
}
