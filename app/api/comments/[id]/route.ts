import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";

const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

async function loadOwnedComment(id: string, userId: string) {
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return { comment: null, owns: false };
  return { comment, owns: comment.authorId === userId };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const { comment, owns } = await loadOwnedComment(id, user.id);
  if (!comment) return notFound("Comentario");
  if (!owns) return forbidden();

  const parsed = updateCommentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const updated = await prisma.comment.update({
    where: { id },
    data: { body: parsed.data.body },
    include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });

  return NextResponse.json({ comment: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const { comment, owns } = await loadOwnedComment(id, user.id);
  if (!comment) return notFound("Comentario");
  if (!owns) return forbidden();

  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
