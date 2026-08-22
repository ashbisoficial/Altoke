import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const addRequirementSchema = z.object({
  issueId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = addRequirementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const requirement = await prisma.issue.findUnique({ where: { id: parsed.data.issueId } });
  if (!requirement || requirement.projectId !== testCase.issue.projectId) {
    return errorResponse(400, "El requisito debe pertenecer al mismo proyecto");
  }

  const link = await prisma.testCaseRequirement.create({
    data: { testCaseId: id, issueId: parsed.data.issueId },
    include: { issue: { select: { id: true, key: true, title: true } } },
  });

  return NextResponse.json({ link }, { status: 201 });
}
