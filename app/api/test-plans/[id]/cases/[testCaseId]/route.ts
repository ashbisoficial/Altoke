import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; testCaseId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: testPlanId, testCaseId } = await params;

  const testPlan = await prisma.testPlan.findUnique({ where: { id: testPlanId } });
  if (!testPlan) return notFound("Plan de pruebas");
  if (!(await hasProjectPermission(user.id, testPlan.projectId, "testing.manage"))) return forbidden();

  await prisma.testPlanCase.deleteMany({ where: { testPlanId, testCaseId } });
  return NextResponse.json({ ok: true });
}
