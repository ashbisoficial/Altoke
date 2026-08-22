import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const LINK_TYPES = [
  "BLOCKS",
  "IS_BLOCKED_BY",
  "RELATES_TO",
  "DUPLICATES",
  "IS_DUPLICATED_BY",
  "CAUSES",
  "IS_CAUSED_BY",
] as const;

const createLinkSchema = z.object({
  targetId: z.string().min(1),
  type: z.enum(LINK_TYPES),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return forbidden();

  const parsed = createLinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { targetId, type } = parsed.data;

  if (targetId === id) return errorResponse(400, "Una incidencia no puede enlazarse a sí misma");

  const target = await prisma.issue.findUnique({ where: { id: targetId } });
  if (!target) return notFound("Incidencia enlazada");
  if (target.projectId !== issue.projectId) {
    return errorResponse(400, "Solo puedes enlazar incidencias del mismo proyecto");
  }

  const link = await prisma.issueLink.create({
    data: { sourceId: id, targetId, type },
    include: { target: { select: { id: true, key: true, title: true } } },
  });

  return NextResponse.json({ link }, { status: 201 });
}
