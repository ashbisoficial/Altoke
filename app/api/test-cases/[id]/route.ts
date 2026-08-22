import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const stepSchema = z.object({
  step: z.string().trim().min(1).max(2000),
  expectedResult: z.string().trim().max(2000).optional(),
});

const updateTestCaseSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  preconditions: z.string().trim().max(5000).nullable().optional(),
  steps: z.array(stepSchema).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: {
      issue: { select: { id: true, key: true, title: true, projectId: true } },
      requirements: { include: { issue: { select: { id: true, key: true, title: true } } } },
      runs: {
        include: {
          execution: { select: { id: true, name: true, testPlanId: true } },
          executedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!testCase) return notFound("Caso de prueba");
  if (!(await isProjectMember(user.id, testCase.issue.projectId))) return forbidden();

  return NextResponse.json({ testCase });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: { issue: { select: { projectId: true } } },
  });
  if (!testCase) return notFound("Caso de prueba");
  if (!(await hasProjectPermission(user.id, testCase.issue.projectId, "testing.manage"))) {
    return forbidden();
  }

  const parsed = updateTestCaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { title, ...testCaseFields } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    if (title) {
      await tx.issue.update({ where: { id: testCase.issueId }, data: { title } });
    }
    return tx.testCase.update({
      where: { id },
      data: testCaseFields,
      include: {
        issue: { select: { id: true, key: true, title: true } },
        requirements: { include: { issue: { select: { id: true, key: true, title: true } } } },
      },
    });
  });

  return NextResponse.json({ testCase: updated });
}
