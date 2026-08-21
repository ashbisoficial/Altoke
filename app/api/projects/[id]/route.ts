import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await isProjectMember(user.id, id))) return forbidden();

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      issueTypes: true,
      labels: true,
      components: true,
      boards: true,
      sprints: { orderBy: { createdAt: "desc" } },
      members: { include: { user: true, role: true } },
      workflow: {
        include: {
          statuses: { orderBy: { order: "asc" } },
          transitions: true,
        },
      },
    },
  });
  if (!project) return notFound("Proyecto");

  return NextResponse.json({ project });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await hasProjectPermission(user.id, id, "project.manage"))) return forbidden();

  const parsed = updateProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return notFound("Proyecto");

  const project = await prisma.project.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ project });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await hasProjectPermission(user.id, id, "project.delete"))) return forbidden();

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing) return notFound("Proyecto");

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
