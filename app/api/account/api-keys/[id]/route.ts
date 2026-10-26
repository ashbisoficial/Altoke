import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`apiKeys/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Llave");
  if (snap.data()!.userId !== user.id) return forbidden();

  await ref.update({ revokedAt: new Date() });
  return NextResponse.json({ ok: true });
}
