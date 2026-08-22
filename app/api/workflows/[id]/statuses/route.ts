import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const createStatusSchema = z.object({
  name: z.string().trim().min(1).max(50),
  category: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido, usa formato #RRGGBB"),
  order: z.number().int().min(0).max(999).optional(),
  isInitial: z.boolean().optional(),
});

async function resolveWorkflowProject(workflowId: string) {
  return prisma.project.findFirst({ where: { workflowId } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: workflowId } = await params;

  const project = await resolveWorkflowProject(workflowId);
  if (!project) return notFound("Flujo de trabajo");
  if (!(await hasProjectPermission(user.id, project.id, "workflow.edit"))) return forbidden();

  const parsed = createStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { isInitial, ...rest } = parsed.data;

  const status = await prisma.$transaction(async (tx) => {
    if (isInitial) {
      await tx.workflowStatus.updateMany({ where: { workflowId }, data: { isInitial: false } });
    }
    return tx.workflowStatus.create({
      data: { workflowId, isInitial: isInitial ?? false, ...rest },
    });
  });

  return NextResponse.json({ status }, { status: 201 });
}
