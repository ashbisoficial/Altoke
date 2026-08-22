import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const addCaseSchema = z.object({
  testCaseId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: testPlanId } = await params;

  const testPlan = await prisma.testPlan.findUnique({ where: { id: testPlanId } });
  if (!testPlan) return notFound("Plan de pruebas");
  if (!(await hasProjectPermission(user.id, testPlan.projectId, "testing.manage"))) return forbidden();

  const parsed = addCaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const testCase = await prisma.testCase.findUnique({
    where: { id: parsed.data.testCaseId },
    include: { issue: { select: { projectId: true } } },
  });
  if (!testCase || testCase.issue.projectId !== testPlan.projectId) {
    return errorResponse(400, "El caso de prueba debe pertenecer al mismo proyecto");
  }

  const existing = await prisma.testPlanCase.findUnique({
    where: { testPlanId_testCaseId: { testPlanId, testCaseId: testCase.id } },
  });
  if (existing) return errorResponse(409, "Ese caso ya está en el plan");

  const link = await prisma.testPlanCase.create({
    data: { testPlanId, testCaseId: testCase.id },
    include: { testCase: { include: { issue: { select: { id: true, key: true, title: true } } } } },
  });

  return NextResponse.json({ link }, { status: 201 });
}
