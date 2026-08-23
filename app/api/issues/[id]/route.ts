import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { PRIORITY_LABEL } from "@/lib/priority";

const updateIssueSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  priority: z.enum(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"]).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  sprintId: z.string().min(1).nullable().optional(),
  storyPoints: z.number().int().min(0).max(999).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      issueType: true,
      status: true,
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
      labels: { include: { label: true } },
      components: { include: { component: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: true,
      children: { include: { issueType: true, status: true } },
      parent: { select: { id: true, key: true, title: true } },
      linksFrom: { include: { target: { select: { id: true, key: true, title: true } } } },
      linksTo: { include: { source: { select: { id: true, key: true, title: true } } } },
    },
  });
  if (!issue) return notFound("Incidencia");
  if (!(await isProjectMember(user.id, issue.projectId))) return forbidden();

  return NextResponse.json({ issue });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await prisma.issue.findUnique({
    where: { id },
    include: {
      assignee: { select: { name: true, email: true } },
      sprint: { select: { name: true } },
    },
  });
  if (!existing) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, existing.projectId, "issue.edit"))) return forbidden();

  const parsed = updateIssueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { dueDate, ...rest } = parsed.data;

  const issue = await prisma.issue.update({
    where: { id },
    data: {
      ...rest,
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
    },
    include: { issueType: true, status: true, assignee: true, reporter: true, sprint: true },
  });

  if (rest.assigneeId && rest.assigneeId !== existing.assigneeId) {
    await notify({
      userId: rest.assigneeId,
      actorId: user.id,
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
      fromLabel: existing.assignee ? existing.assignee.name ?? existing.assignee.email : "Sin asignar",
      toLabel: issue.assignee ? issue.assignee.name ?? issue.assignee.email : "Sin asignar",
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
      data: activities.map((a) => ({ issueId: id, actorId: user.id, ...a })),
    });
  }

  return NextResponse.json({ issue });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await prisma.issue.findUnique({ where: { id } });
  if (!existing) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, existing.projectId, "issue.delete"))) return forbidden();

  await prisma.issue.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
