import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, updateIssue, updateIssueInput } from "@/lib/issue-service";
import {
  v1Error,
  v1Forbidden,
  v1NotFound,
  v1ValidationError,
} from "@/lib/api-v1";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "READ");
  if (!auth.ok) return auth.response;
  const user = auth.user;
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
  if (!issue) return v1NotFound("Incidencia");
  if (!(await isProjectMember(user.id, issue.projectId))) return v1Forbidden();

  return NextResponse.json({ issue });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "WRITE");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;

  const existing = await prisma.issue.findUnique({ where: { id }, select: { projectId: true } });
  if (!existing) return v1NotFound("Incidencia");
  if (!(await hasProjectPermission(user.id, existing.projectId, "issue.edit"))) return v1Forbidden();

  const parsed = updateIssueInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return v1ValidationError(parsed.error);

  try {
    const issue = await updateIssue(user.id, id, parsed.data);
    return NextResponse.json({ issue });
  } catch (e) {
    if (e instanceof ServiceError) return v1Error(e.status, e.message);
    throw e;
  }
}
