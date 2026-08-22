import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const stepSchema = z.object({
  step: z.string().trim().min(1).max(2000),
  expectedResult: z.string().trim().max(2000).optional(),
});

const createTestCaseSchema = z.object({
  title: z.string().trim().min(1).max(255),
  preconditions: z.string().trim().max(5000).optional(),
  steps: z.array(stepSchema).default([]),
  requirementIds: z.array(z.string().min(1)).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const testCases = await prisma.testCase.findMany({
    where: { issue: { projectId } },
    include: {
      issue: { select: { id: true, key: true, title: true } },
      requirements: { include: { issue: { select: { id: true, key: true, title: true } } } },
      _count: { select: { runs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ testCases });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "testing.manage"))) return forbidden();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workflow: { include: { statuses: true } } },
  });
  if (!project) return notFound("Proyecto");

  const parsed = createTestCaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { title, preconditions, steps, requirementIds } = parsed.data;

  const testCaseType = await prisma.issueType.findFirst({
    where: { projectId, name: "Caso de Prueba" },
  });
  if (!testCaseType) {
    return errorResponse(500, "El proyecto no tiene el tipo 'Caso de Prueba' configurado");
  }

  const initialStatus =
    project.workflow.statuses.find((s) => s.isInitial) ?? project.workflow.statuses[0];
  if (!initialStatus) return errorResponse(500, "El proyecto no tiene un flujo de trabajo válido");

  if (requirementIds && requirementIds.length > 0) {
    const requirementCount = await prisma.issue.count({
      where: { id: { in: requirementIds }, projectId },
    });
    if (requirementCount !== requirementIds.length) {
      return errorResponse(400, "Alguno de los requisitos no pertenece a este proyecto");
    }
  }

  const testCase = await prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id: projectId },
      data: { issueCounter: { increment: 1 } },
    });
    const number = updatedProject.issueCounter;

    const issue = await tx.issue.create({
      data: {
        projectId,
        number,
        key: `${updatedProject.key}-${number}`,
        issueTypeId: testCaseType.id,
        title,
        statusId: initialStatus.id,
        reporterId: user.id,
      },
    });

    return tx.testCase.create({
      data: {
        issueId: issue.id,
        preconditions,
        steps,
        requirements: requirementIds
          ? { create: requirementIds.map((issueId) => ({ issueId })) }
          : undefined,
      },
      include: {
        issue: { select: { id: true, key: true, title: true } },
        requirements: { include: { issue: { select: { id: true, key: true, title: true } } } },
      },
    });
  });

  return NextResponse.json({ testCase }, { status: 201 });
}
