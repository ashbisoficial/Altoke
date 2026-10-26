import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const unreadSnap = await adminDb
    .collection("notifications")
    .where("userId", "==", user.id)
    .where("read", "==", false)
    .get();

  const batch = adminDb.batch();
  unreadSnap.docs.forEach((doc) => batch.update(doc.ref, { read: true }));
  await batch.commit();

  return NextResponse.json({ ok: true });
}
