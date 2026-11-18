import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureProjectRanks, rankAtEnd } from "@/lib/rank-service";
import { notify } from "@/lib/notifications";
import { PRIORITY_LABEL } from "@/lib/priority";

/**
 * Shared issue create/update logic used by both the session-based routes
 * (app/api/issues/**) and the public API (app/api/v1/**), so the two never
 * drift out of sync on validation, workflow rules, or activity logging.
 */
export class ServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const createIssueInput = z.object({
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

export async function createIssue(reporterId: string, data: z.infer<typeof createIssueInput>) {
  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    include: { workflow: { include: { statuses: true } } },
  });
  if (!project) throw new ServiceError(404, "Proyecto no encontrado");

  const issueType = await prisma.issueType.findFirst({
    where: { id: data.issueTypeId, projectId: data.projectId },
  });
  if (!issueType) throw new ServiceError(400, "Tipo de incidencia inválido para este proyecto");

  const initialStatus = project.workflow.statuses.find((s) => s.isInitial) ?? project.workflow.statuses[0];
  if (!initialStatus) throw new ServiceError(500, "El proyecto no tiene un flujo de trabajo válido");

  await ensureProjectRanks(data.projectId);

  // Dos creaciones simultáneas pueden calcular el mismo rank; la restricción
  // única lo detecta y la transacción se reintenta con valores frescos.
  for (let attempt = 1; ; attempt++) {
    try {
      return await createIssueOnce(reporterId, data, initialStatus.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && attempt < 4) continue;
      throw e;
    }
  }
}

async function createIssueOnce(
  reporterId: string,
  data: z.infer<typeof createIssueInput>,
  statusId: string,
) {
  return prisma.$transaction(async (tx) => {
    const updatedProject = await tx.project.update({
      where: { id: data.projectId },
      data: { issueCounter: { increment: 1 } },
    });
    const number = updatedProject.issueCounter;
    const rank = await rankAtEnd(tx, data.projectId);

    return tx.issue.create({
      data: {
        projectId: data.projectId,
        number,
        rank,
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
        statusId,
        reporterId,
      },
      include: { issueType: true, status: true, assignee: true, reporter: true },
    });
  });
}

export const updateIssueInput = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  priority: z.enum(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"]).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  sprintId: z.string().min(1).nullable().optional(),
  storyPoints: z.number().int().min(0).max(999).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function updateIssue(
  actorId: string,
  issueId: string,
  data: z.infer<typeof updateIssueInput>,
) {
  const existing = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      assignee: { select: { name: true, email: true } },
      sprint: { select: { name: true } },
    },
  });
  if (!existing) throw new ServiceError(404, "Incidencia no encontrada");

  const { dueDate, ...rest } = data;

  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
    include: { issueType: true, status: true, assignee: true, reporter: true, sprint: true },
  });

  if (rest.assigneeId && rest.assigneeId !== existing.assigneeId) {
    await notify({
      userId: rest.assigneeId,
      actorId,
      type: "ISSUE_ASSIGNED",
      title: `Te asignaron ${issue.key}`,
      body: issue.title,
      link: `/issues/${issue.id}`,
    });
  }

  const activities: { field: string; fromLabel: string | null; toLabel: string | null }[] = [];
  if (rest.priority && rest.priority !== existing.priority) {
    activities.push({
      field: "priority",
      fromLabel: PRIORITY_LABEL[existing.priority],
      toLabel: PRIORITY_LABEL[rest.priority],
    });
  }
  if (rest.assigneeId !== undefined && rest.assigneeId !== existing.assigneeId) {
    activities.push({
      field: "assignee",
      fromLabel: existing.assignee ? (existing.assignee.name ?? existing.assignee.email) : "Sin asignar",
      toLabel: issue.assignee ? (issue.assignee.name ?? issue.assignee.email) : "Sin asignar",
    });
  }
  if (rest.sprintId !== undefined && rest.sprintId !== existing.sprintId) {
    activities.push({
      field: "sprint",
      fromLabel: existing.sprint?.name ?? "Backlog",
      toLabel: issue.sprint?.name ?? "Backlog",
    });
  }
  if (activities.length > 0) {
    await prisma.issueActivity.createMany({
      data: activities.map((a) => ({ issueId, actorId, ...a })),
    });
  }

  return issue;
}
