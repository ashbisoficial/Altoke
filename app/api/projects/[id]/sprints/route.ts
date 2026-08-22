import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createSprintSchema = z.object({
  name: z.string().trim().min(1).max(100),
  goal: z.string().trim().max(1000).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    include: { _count: { select: { issues: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ sprints });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "sprint.manage"))) return forbidden();

  const parsed = createSprintSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const sprint = await prisma.sprint.create({ data: { projectId, ...parsed.data } });
  return NextResponse.json({ sprint }, { status: 201 });
}
