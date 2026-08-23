import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const transitionSchema = z.object({
  toStatusId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: { project: { select: { workflowId: true } }, status: { select: { name: true } } },
  });
  if (!issue) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.transition"))) {
    return forbidden();
  }

  const parsed = transitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { toStatusId } = parsed.data;

  if (toStatusId === issue.statusId) {
    return errorResponse(400, "La incidencia ya está en ese estado");
  }

  // The move is only legal if the project's workflow declares a transition
  // from the issue's current status to the requested one.
  const transition = await prisma.workflowTransition.findFirst({
    where: {
      workflowId: issue.project.workflowId,
      fromStatusId: issue.statusId,
      toStatusId,
    },
  });
  if (!transition) {
    return errorResponse(
      422,
      "Esa transición no está permitida por el flujo de trabajo del proyecto",
    );
  }

  const updated = await prisma.issue.update({
    where: { id },
    data: { statusId: toStatusId },
    include: { issueType: true, status: true, assignee: true, reporter: true },
  });

  await prisma.issueActivity.create({
    data: {
      issueId: id,
      actorId: user.id,
      field: "status",
      fromLabel: issue.status.name,
      toLabel: updated.status.name,
    },
  });

  return NextResponse.json({ issue: updated });
}
