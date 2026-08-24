import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, createIssue, createIssueInput } from "@/lib/issue-service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const searchParams = request.nextUrl.searchParams;
  const sprintId = searchParams.get("sprintId");
  const assigneeId = searchParams.get("assigneeId");

  const issues = await prisma.issue.findMany({
    where: {
      projectId,
      ...(sprintId ? { sprintId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    },
    include: {
      issueType: { select: { id: true, name: true, color: true } },
      status: { select: { id: true, name: true, color: true, category: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ issues });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "issue.create"))) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = createIssueInput.safeParse({ ...body, projectId });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const issue = await createIssue(user.id, parsed.data);
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
