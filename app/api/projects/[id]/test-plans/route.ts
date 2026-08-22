import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createTestPlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sprintId: z.string().min(1).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const testPlans = await prisma.testPlan.findMany({
    where: { projectId },
    include: {
      sprint: { select: { id: true, name: true } },
      _count: { select: { cases: true, executions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ testPlans });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "testing.manage"))) return forbidden();

  const parsed = createTestPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const testPlan = await prisma.testPlan.create({ data: { projectId, ...parsed.data } });
  return NextResponse.json({ testPlan }, { status: 201 });
}
