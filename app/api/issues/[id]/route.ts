import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { softDeleteIssue } from "@/lib/trash-service";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, updateIssue, updateIssueInput } from "@/lib/issue-service";

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
      comments: {
        where: { deletedAt: null },
        include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: true,
      children: { where: { deletedAt: null }, include: { issueType: true, status: true } },
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

  const existing = await prisma.issue.findUnique({ where: { id }, select: { projectId: true } });
  if (!existing) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, existing.projectId, "issue.edit"))) return forbidden();

  const parsed = updateIssueInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const issue = await updateIssue(user.id, id, parsed.data);
    return NextResponse.json({ issue });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message, e.fields);
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await prisma.issue.findUnique({ where: { id } });
  if (!existing) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, existing.projectId, "issue.delete"))) return forbidden();

  // Borrado lógico: queda en la papelera y se puede restaurar (F0-8).
  await softDeleteIssue(id);
  return NextResponse.json({ ok: true });
}
