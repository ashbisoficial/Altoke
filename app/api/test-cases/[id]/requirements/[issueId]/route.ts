import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id, issueId } = await params;

  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: { issue: { select: { projectId: true } } },
  });
  if (!testCase) return notFound("Caso de prueba");
  if (!(await hasProjectPermission(user.id, testCase.issue.projectId, "testing.manage"))) {
    return forbidden();
  }

  await prisma.testCaseRequirement.deleteMany({ where: { testCaseId: id, issueId } });
  return NextResponse.json({ ok: true });
}
