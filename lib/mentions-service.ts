import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { resolveMentions } from "@/lib/mentions";

/**
 * Notifica a quien fue mencionado en un texto de una incidencia. Si se pasa
 * `previousText`, solo se notifica a quien es nuevo en el texto: editar una
 * descripción no vuelve a avisar a los mencionados de antes.
 */
export async function notifyMentions({
  actorId,
  issueId,
  projectId,
  issueKey,
  issueTitle,
  text,
  previousText,
}: {
  actorId: string;
  issueId: string;
  projectId: string;
  issueKey: string;
  issueTitle: string;
  text: string;
  previousText?: string | null;
}) {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
  if (!project) return;

  const members = await prisma.membership.findMany({
    where: { organizationId: project.organizationId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  const users = members.map((m) => m.user);

  const now = new Set(resolveMentions(text, users, actorId));
  const before = new Set(previousText ? resolveMentions(previousText, users, actorId) : []);
  for (const userId of now) {
    if (before.has(userId)) continue;
    await notify({
      userId,
      actorId,
      type: "MENTIONED",
      title: `Te mencionaron en ${issueKey}`,
      body: issueTitle,
      link: `/issues/${issueId}`,
    });
  }
}
