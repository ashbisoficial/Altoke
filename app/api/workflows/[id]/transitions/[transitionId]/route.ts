import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; transitionId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: workflowId, transitionId } = await params;

  const project = await prisma.project.findFirst({ where: { workflowId } });
  if (!project) return notFound("Flujo de trabajo");
  if (!(await hasProjectPermission(user.id, project.id, "workflow.edit"))) return forbidden();

  const existing = await prisma.workflowTransition.findFirst({
    where: { id: transitionId, workflowId },
  });
  if (!existing) return notFound("Transición");

  await prisma.workflowTransition.delete({ where: { id: transitionId } });
  return NextResponse.json({ ok: true });
}
