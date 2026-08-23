import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const attachLabelSchema = z.object({ labelId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return forbidden();

  const parsed = attachLabelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { labelId } = parsed.data;

  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) return notFound("Etiqueta");
  if (label.projectId !== issue.projectId) {
    return errorResponse(400, "La etiqueta no pertenece a este proyecto");
  }

  const issueLabel = await prisma.issueLabel.upsert({
    where: { issueId_labelId: { issueId: id, labelId } },
    update: {},
    create: { issueId: id, labelId },
    include: { label: true },
  });

  return NextResponse.json({ issueLabel }, { status: 201 });
}
