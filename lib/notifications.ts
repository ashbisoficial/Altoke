import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export type NotificationType = "ISSUE_ASSIGNED" | "ISSUE_COMMENTED" | "PROJECT_MEMBER_ADDED" | "ORG_INVITATION";

/** Creates an in-app notification. Silently skips notifying the actor themselves. */
export async function notify({
  userId,
  actorId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}) {
  if (actorId && actorId === userId) return;
  await adminDb.collection("notifications").add({
    userId,
    type,
    title,
    body: body ?? null,
    link: link ?? null,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}
