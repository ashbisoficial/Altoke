import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/issue-service";

/**
 * Borrado lógico y papelera (F0-8).
 *
 * Borrar una incidencia la marca con `deletedAt` junto con sus subtareas,
 * usando la misma marca de tiempo. Así restaurar recupera el conjunto
 * completo y no se mezclan borrados de distintos momentos. Comentarios,
 * enlaces y adjuntos no se tocan: siguen asociados a la incidencia.
 */

async function collectDescendantIds(rootId: string): Promise<string[]> {
  const ids: string[] = [];
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = await prisma.issue.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

export async function softDeleteIssue(issueId: string) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { id: true } });
  if (!issue) throw new ServiceError(404, "Incidencia no encontrada");

  const ids = [issueId, ...(await collectDescendantIds(issueId))];
  await prisma.issue.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
  return { deleted: ids.length };
}

export async function restoreIssue(issueId: string) {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId, deletedAt: { not: null } },
    select: { id: true, deletedAt: true, parentId: true, projectId: true },
  });
  if (!issue || !issue.deletedAt) throw new ServiceError(404, "La incidencia no está en la papelera");

  if (issue.parentId) {
    const parent = await prisma.issue.findUnique({ where: { id: issue.parentId }, select: { id: true } });
    if (!parent) {
      throw new ServiceError(409, "La incidencia padre está en la papelera; restáurala primero");
    }
  }

  // Restaura la incidencia y las subtareas borradas en el mismo momento.
  const stamp = issue.deletedAt;
  const descendants = await prisma.issue.findMany({
    where: { parentId: issueId, deletedAt: stamp },
    select: { id: true },
  });
  const ids = [issueId];
  let frontier = descendants.map((d) => d.id);
  while (frontier.length > 0) {
    ids.push(...frontier);
    const next = await prisma.issue.findMany({
      where: { parentId: { in: frontier }, deletedAt: stamp },
      select: { id: true },
    });
    frontier = next.map((n) => n.id);
  }

  await prisma.issue.updateMany({ where: { id: { in: ids }, deletedAt: stamp }, data: { deletedAt: null } });
  return { restored: ids.length };
}

export async function softDeleteComment(commentId: string) {
  const { count } = await prisma.comment.updateMany({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw new ServiceError(404, "Comentario no encontrado");
}

export async function restoreComment(commentId: string) {
  const { count } = await prisma.comment.updateMany({
    where: { id: commentId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (count === 0) throw new ServiceError(404, "El comentario no está en la papelera");
}

export async function softDeleteTestCase(testCaseId: string) {
  const { count } = await prisma.testCase.updateMany({
    where: { id: testCaseId },
    data: { deletedAt: new Date() },
  });
  if (count === 0) throw new ServiceError(404, "Caso de prueba no encontrado");
}

export async function restoreTestCase(testCaseId: string) {
  const { count } = await prisma.testCase.updateMany({
    where: { id: testCaseId, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  if (count === 0) throw new ServiceError(404, "El caso de prueba no está en la papelera");
}
