import { prisma } from "@/lib/prisma";
import type { NotificationType } from "@prisma/client";

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
  await prisma.notification.create({ data: { userId, type, title, body, link } });
}
