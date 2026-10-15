import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";

const updateCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`comments/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Comentario");
  if (snap.data()!.authorId !== user.id) return forbidden();

  const parsed = updateCommentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  await ref.update({ body: parsed.data.body });
  const updated = await ref.get();
  const data = updated.data()!;
  return NextResponse.json({ comment: { id, ...data, createdAt: tsToISO(data.createdAt) } });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`comments/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Comentario");
  if (snap.data()!.authorId !== user.id) return forbidden();

  await ref.delete();
  return NextResponse.json({ ok: true });
}
