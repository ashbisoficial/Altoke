import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { notify } from "@/lib/notifications";

const addMemberSchema = z.object({
  email: z.string().trim().email(),
  roleId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "member.manage"))) return forbidden();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return notFound("Proyecto");

  const parsed = addMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { email, roleId } = parsed.data;

  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId: project.organizationId },
  });
  if (!role) return errorResponse(400, "Rol inválido para esta organización");

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    return errorResponse(404, "Ese correo todavía no tiene una cuenta en Altoke.");
  }

  const orgMembership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUser.id, organizationId: project.organizationId } },
  });
  if (!orgMembership) {
    return errorResponse(
      409,
      "Ese usuario todavía no pertenece a la organización. Agrégalo desde la organización primero.",
    );
  }

  const existing = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: targetUser.id, projectId } },
  });
  if (existing) return errorResponse(409, "Ese usuario ya es miembro del proyecto");

  const member = await prisma.projectMember.create({
    data: { userId: targetUser.id, projectId, roleId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, role: true },
  });

  await notify({
    userId: targetUser.id,
    actorId: user.id,
    type: "PROJECT_MEMBER_ADDED",
    title: `Te añadieron al proyecto ${project.name}`,
    link: `/board?projectId=${projectId}`,
  });

  return NextResponse.json({ member }, { status: 201 });
}
