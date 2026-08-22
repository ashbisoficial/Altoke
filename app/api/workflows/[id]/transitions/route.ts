import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const createTransitionSchema = z.object({
  name: z.string().trim().min(1).max(50),
  fromStatusId: z.string().min(1),
  toStatusId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: workflowId } = await params;

  const project = await prisma.project.findFirst({ where: { workflowId } });
  if (!project) return notFound("Flujo de trabajo");
  if (!(await hasProjectPermission(user.id, project.id, "workflow.edit"))) return forbidden();

  const parsed = createTransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { fromStatusId, toStatusId } = parsed.data;

  if (fromStatusId === toStatusId) {
    return errorResponse(400, "El estado de origen y destino no pueden ser el mismo");
  }

  const [fromStatus, toStatus] = await Promise.all([
    prisma.workflowStatus.findFirst({ where: { id: fromStatusId, workflowId } }),
    prisma.workflowStatus.findFirst({ where: { id: toStatusId, workflowId } }),
  ]);
  if (!fromStatus || !toStatus) {
    return errorResponse(400, "Ambos estados deben pertenecer a este flujo de trabajo");
  }

  const transition = await prisma.workflowTransition.create({
    data: { workflowId, name: parsed.data.name, fromStatusId, toStatusId },
  });

  return NextResponse.json({ transition }, { status: 201 });
}
