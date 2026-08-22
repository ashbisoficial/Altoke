import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateStatusSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  category: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  order: z.number().int().min(0).max(999).optional(),
  isInitial: z.boolean().optional(),
});

async function authorize(workflowId: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { workflowId } });
  if (!project) return { ok: false as const, reason: "not-found" as const };
  if (!(await hasProjectPermission(userId, project.id, "workflow.edit"))) {
    return { ok: false as const, reason: "forbidden" as const };
  }
  return { ok: true as const, project };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: workflowId, statusId } = await params;

  const auth = await authorize(workflowId, user.id);
  if (!auth.ok) return auth.reason === "not-found" ? notFound("Flujo de trabajo") : forbidden();

  const parsed = updateStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { isInitial, ...rest } = parsed.data;

  const existing = await prisma.workflowStatus.findFirst({ where: { id: statusId, workflowId } });
  if (!existing) return notFound("Estado");

  const status = await prisma.$transaction(async (tx) => {
    if (isInitial) {
      await tx.workflowStatus.updateMany({ where: { workflowId }, data: { isInitial: false } });
    }
    return tx.workflowStatus.update({
      where: { id: statusId },
      data: { ...rest, ...(isInitial !== undefined ? { isInitial } : {}) },
    });
  });

  return NextResponse.json({ status });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: workflowId, statusId } = await params;

  const auth = await authorize(workflowId, user.id);
  if (!auth.ok) return auth.reason === "not-found" ? notFound("Flujo de trabajo") : forbidden();

  const existing = await prisma.workflowStatus.findFirst({ where: { id: statusId, workflowId } });
  if (!existing) return notFound("Estado");

  const issuesInStatus = await prisma.issue.count({ where: { statusId } });
  if (issuesInStatus > 0) {
    return errorResponse(409, "No puedes eliminar un estado que tiene incidencias asignadas");
  }

  await prisma.workflowStatus.delete({ where: { id: statusId } });
  return NextResponse.json({ ok: true });
}
