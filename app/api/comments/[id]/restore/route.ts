import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized } from "@/lib/http";
import { ServiceError } from "@/lib/issue-service";
import { restoreComment } from "@/lib/trash-service";

/** Restaura un comentario borrado. Solo su autor puede restaurarlo (igual que borrarlo). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const comment = await prisma.comment.findUnique({
    where: { id, deletedAt: { not: null } },
    select: { authorId: true },
  });
  if (!comment) return notFound("Comentario en la papelera");
  if (comment.authorId !== user.id) return forbidden();

  try {
    await restoreComment(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message, e.fields);
    throw e;
  }
}
