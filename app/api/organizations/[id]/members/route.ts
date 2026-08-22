import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";

const addMemberSchema = z.object({
  email: z.string().trim().email(),
  roleId: z.string().min(1),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();

  const members = await prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, role: true },
    orderBy: { createdAt: "asc" },
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
  const { email, roleId } = parsed.data;

  const role = await prisma.role.findFirst({ where: { id: roleId, organizationId } });
  if (!role) return errorResponse(400, "Rol inválido para esta organización");

  const targetUser = await prisma.user.findUnique({ where: { email } });
  if (!targetUser) {
    return errorResponse(404, "Ese correo todavía no tiene una cuenta en Altoke. Pídele que se registre primero.");
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: targetUser.id, organizationId } },
  });
  if (existing) return errorResponse(409, "Ese usuario ya es miembro de la organización");

  const membership = await prisma.membership.create({
    data: { userId: targetUser.id, organizationId, roleId },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } }, role: true },
  });

  return NextResponse.json({ membership }, { status: 201 });
}
