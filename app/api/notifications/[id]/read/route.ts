import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/http";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`notifications/${id}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()!.userId !== user.id) return notFound("Notificación");

  await ref.update({ read: true });
  return NextResponse.json({ ok: true });
}
