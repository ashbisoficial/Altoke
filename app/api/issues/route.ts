import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createIssueSchema = z.object({
  projectId: z.string().min(1),
  issueTypeId: z.string().min(1),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).optional(),
  priority: z.enum(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"]).optional(),
  assigneeId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  sprintId: z.string().min(1).optional(),
  storyPoints: z.number().int().min(0).max(999).optional(),
  dueDate: z.string().datetime().optional(),
});

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

  const parsed = createIssueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  if (!(await hasProjectPermission(user.id, data.projectId, "issue.create"))) return forbidden();

  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    include: { workflow: { include: { statuses: true } } },
  });
  if (!project) return notFound("Proyecto");

  const issueType = await prisma.issueType.findFirst({
    where: { id: data.issueTypeId, projectId: data.projectId },
  });
  if (!issueType) return errorResponse(400, "Tipo de incidencia inválido para este proyecto");

  const initialStatus =
    project.workflow.statuses.find((s) => s.isInitial) ?? project.workflow.statuses[0];
  if (!initialStatus) return errorResponse(500, "El proyecto no tiene un flujo de trabajo válido");

  const issue = await prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id: data.projectId },
      data: { issueCounter: { increment: 1 } },
    });
    const number = updatedProject.issueCounter;

    return tx.issue.create({
      data: {
        projectId: data.projectId,
        number,
        key: `${updatedProject.key}-${number}`,
        issueTypeId: data.issueTypeId,
        title: data.title,
        description: data.description,
        priority: data.priority ?? "MEDIUM",
        assigneeId: data.assigneeId,
        parentId: data.parentId,
        sprintId: data.sprintId,
        storyPoints: data.storyPoints,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        statusId: initialStatus.id,
        reporterId: user.id,
      },
      include: { issueType: true, status: true, assignee: true, reporter: true },
    });
  });

  return NextResponse.json({ issue }, { status: 201 });
}
