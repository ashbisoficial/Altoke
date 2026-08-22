import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const createExecutionSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: testPlanId } = await params;

  const testPlan = await prisma.testPlan.findUnique({
    where: { id: testPlanId },
    include: { cases: true },
  });
  if (!testPlan) return notFound("Plan de pruebas");
  if (!(await hasProjectPermission(user.id, testPlan.projectId, "testing.manage"))) return forbidden();

  if (testPlan.cases.length === 0) {
    return errorResponse(400, "Añade al menos un caso de prueba al plan antes de crear una ejecución");
  }

  const parsed = createExecutionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const execution = await prisma.$transaction(async (tx) => {
    const created = await tx.testExecution.create({
      data: { testPlanId, name: parsed.data.name },
    });
    await tx.testRun.createMany({
      data: testPlan.cases.map((c) => ({ executionId: created.id, testCaseId: c.testCaseId })),
    });
    return tx.testExecution.findUniqueOrThrow({
      where: { id: created.id },
      include: { runs: { include: { executedBy: { select: { id: true, name: true, email: true } } } } },
    });
  });

  return NextResponse.json({ execution }, { status: 201 });
}
