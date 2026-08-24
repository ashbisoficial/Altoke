import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, createIssue, createIssueInput } from "@/lib/issue-service";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const projectId = params.get("projectId");
  if (!projectId) return errorResponse(400, "projectId es requerido");
  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const sprintId = params.get("sprintId");
  const assigneeId = params.get("assigneeId");
  const parentId = params.get("parentId");

  const issues = await prisma.issue.findMany({
    where: {
      projectId,
      ...(sprintId ? { sprintId } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(parentId !== null ? { parentId: parentId || null } : {}),
    },
    include: {
      issueType: true,
      status: true,
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
      labels: { include: { label: true } },
      _count: { select: { children: true, comments: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ issues });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createIssueInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  if (!(await hasProjectPermission(user.id, parsed.data.projectId, "issue.create"))) return forbidden();

  try {
    const issue = await createIssue(user.id, parsed.data);
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
