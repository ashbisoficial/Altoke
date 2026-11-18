import { prisma } from "@/lib/prisma";

/**
 * Contenido de la papelera de un proyecto (F0-8). Las consultas nombran
 * deletedAt, así que la extensión de lib/prisma.ts no las filtra.
 * Los comentarios solo se muestran a su autor, que es quien puede restaurarlos.
 */
export async function loadProjectTrash(projectId: string, userId: string) {
  const [issues, testCases, comments] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId, deletedAt: { not: null } },
      select: { id: true, key: true, title: true, deletedAt: true, parentId: true },
      orderBy: { deletedAt: "desc" },
      take: 200,
    }),
    prisma.testCase.findMany({
      where: { deletedAt: { not: null }, issue: { projectId } },
      select: { id: true, deletedAt: true, issue: { select: { key: true, title: true } } },
      orderBy: { deletedAt: "desc" },
      take: 200,
    }),
    prisma.comment.findMany({
      where: { deletedAt: { not: null }, authorId: userId, issue: { projectId } },
      select: { id: true, body: true, deletedAt: true, issue: { select: { key: true } } },
      orderBy: { deletedAt: "desc" },
      take: 200,
    }),
  ]);

  return {
    // Una subtarea cuyo padre también está en la papelera se restaura con él.
    issues: issues
      .filter((i) => !(i.parentId && issues.some((p) => p.id === i.parentId)))
      .map((i) => ({ id: i.id, key: i.key, title: i.title, deletedAt: i.deletedAt!.toISOString() })),
    testCases: testCases.map((t) => ({
      id: t.id,
      key: t.issue.key,
      title: t.issue.title,
      deletedAt: t.deletedAt!.toISOString(),
    })),
    comments: comments.map((c) => ({
      id: c.id,
      key: c.issue.key,
      body: c.body,
      deletedAt: c.deletedAt!.toISOString(),
    })),
  };
}
