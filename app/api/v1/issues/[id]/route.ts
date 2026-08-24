import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, updateIssue, updateIssueInput } from "@/lib/issue-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      issueType: { select: { id: true, name: true, color: true } },
      status: { select: { id: true, name: true, color: true, category: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
      labels: { include: { label: true } },
    },
  });
  if (!issue) return notFound("Incidencia");
  if (!(await isProjectMember(user.id, issue.projectId))) return forbidden();

  return NextResponse.json({ issue });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await prisma.issue.findUnique({ where: { id }, select: { projectId: true } });
  if (!existing) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, existing.projectId, "issue.edit"))) return forbidden();

  const parsed = updateIssueInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const issue = await updateIssue(user.id, id, parsed.data);
    return NextResponse.json({ issue });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
