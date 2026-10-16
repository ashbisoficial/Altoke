import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const [recentSnap, unreadSnap] = await Promise.all([
    adminDb
      .collection("notifications")
      .where("userId", "==", user.id)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get(),
    adminDb.collection("notifications").where("userId", "==", user.id).where("read", "==", false).count().get(),
  ]);

  const notifications = recentSnap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
    createdAt: tsToISO(d.data().createdAt),
  }));

  return NextResponse.json({ notifications, unreadCount: unreadSnap.data().count });
}
