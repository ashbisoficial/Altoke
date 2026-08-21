import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";
import { createDefaultIssueTypes, createDefaultWorkflow } from "@/lib/seed-defaults";

const createProjectSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  key: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "La key debe ser mayúsculas y números, ej. PROJ"),
  description: z.string().trim().max(2000).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const organizationId = request.nextUrl.searchParams.get("organizationId");

  const projects = await prisma.project.findMany({
    where: {
      organization: { memberships: { some: { userId: user.id } } },
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
      _count: { select: { issues: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createProjectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { organizationId, name, description } = parsed.data;
  const key = parsed.data.key.toUpperCase();

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();
  if (!(await hasOrgPermission(user.id, organizationId, "project.create"))) return forbidden();

  const existing = await prisma.project.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  if (existing) return errorResponse(409, "Ya existe un proyecto con esa key en esta organización");

  const membership = await prisma.membership.findUniqueOrThrow({
    where: { userId_organizationId: { userId: user.id, organizationId } },
  });

  const project = await prisma.$transaction(async (tx) => {
    const { workflowId } = await createDefaultWorkflow(tx, organizationId, `Flujo de ${name}`);

    const created = await tx.project.create({
      data: { organizationId, name, key, description, workflowId },
    });

    await createDefaultIssueTypes(tx, created.id);
    await tx.board.create({ data: { projectId: created.id, name: "Tablero principal" } });
    await tx.projectMember.create({
      data: { userId: user.id, projectId: created.id, roleId: membership.roleId },
    });

    return created;
  });

  return NextResponse.json({ project }, { status: 201 });
}
