import { Prisma } from "@prisma/client";
import { generateKeyBetween, generateNKeysBetween } from "fractional-indexing";
import { prisma, type DbTransaction } from "@/lib/prisma";
import { ServiceError } from "@/lib/issue-service";
import { z } from "zod";

/** Cuerpo de POST /issues/:id/rank: la incidencia quedará entre estos dos vecinos. */
export const placementInput = z.object({
  previousId: z.string().min(1).nullable().optional(),
  nextId: z.string().min(1).nullable().optional(),
});

/**
 * Orden de incidencias dentro de un proyecto (F0-4).
 *
 * Cada incidencia tiene un `rank` (clave fraccionaria). Para colocar una
 * incidencia entre otras dos se calcula una clave entre sus ranks: no hay
 * que reescribir las demás. La restricción única (projectId, rank) garantiza
 * que dos incidencias nunca compartan posición; si dos reordenamientos
 * calculan la misma clave a la vez, el segundo falla y se reintenta con los
 * valores actuales de la base.
 */

const MAX_ATTEMPTS = 4;

/**
 * Serializa los cambios de orden de un proyecto. Sin esto, varios movimientos
 * hacia el mismo hueco calculan la misma clave y solo uno gana por intento.
 * Con el bloqueo, cada transacción lee el orden que dejó la anterior.
 */
async function lockProjectOrder(tx: DbTransaction, projectId: string) {
  await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId} FOR UPDATE`;
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/**
 * Asigna rank a las incidencias que no lo tienen, en orden de creación, a
 * continuación del último rank existente. Idempotente. Se llama antes de
 * leer o reordenar, así que no hace falta un paso manual de migración.
 */
export async function ensureProjectRanks(projectId: string): Promise<number> {
  const missing = await prisma.issue.findMany({
    where: { projectId, rank: null },
    orderBy: [{ createdAt: "asc" }, { number: "asc" }],
    select: { id: true },
  });
  if (missing.length === 0) return 0;

  const last = await prisma.issue.findFirst({
    where: { projectId, rank: { not: null } },
    orderBy: { rank: "desc" },
    select: { rank: true },
  });
  const keys = generateNKeysBetween(last?.rank ?? null, null, missing.length);

  try {
    await prisma.$transaction(async (tx) => {
      await lockProjectOrder(tx, projectId);
      for (let i = 0; i < missing.length; i++) {
        await tx.issue.update({ where: { id: missing[i].id }, data: { rank: keys[i] } });
      }
    });
  } catch (e) {
    // Otra petición hizo el backfill a la vez: el resultado ya es correcto.
    if (isUniqueViolation(e)) return 0;
    throw e;
  }
  return missing.length;
}

/** Rank para una incidencia nueva: al final del proyecto. */
export async function rankAtEnd(tx: DbTransaction, projectId: string): Promise<string> {
  const last = await tx.issue.findFirst({
    where: { projectId, rank: { not: null } },
    orderBy: { rank: "desc" },
    select: { rank: true },
  });
  return generateKeyBetween(last?.rank ?? null, null);
}

/**
 * Coloca `issueId` entre `previousId` y `nextId` (ambos opcionales).
 * Devuelve la incidencia actualizada.
 */
export async function moveIssueRank(
  issueId: string,
  placement: { previousId?: string | null; nextId?: string | null },
) {
  const issue = await prisma.issue.findUnique({ where: { id: issueId }, select: { projectId: true } });
  if (!issue) throw new ServiceError(404, "Incidencia no encontrada");

  const { previousId = null, nextId = null } = placement;
  if (previousId === issueId || nextId === issueId) {
    throw new ServiceError(422, "Una incidencia no puede colocarse junto a sí misma");
  }

  await ensureProjectRanks(issue.projectId);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockProjectOrder(tx, issue.projectId);
        const prev = previousId ? await tx.issue.findUnique({ where: { id: previousId }, select: { projectId: true, rank: true } }) : null;
        const next = nextId ? await tx.issue.findUnique({ where: { id: nextId }, select: { projectId: true, rank: true } }) : null;

        if ((previousId && (!prev || prev.projectId !== issue.projectId)) || (nextId && (!next || next.projectId !== issue.projectId))) {
          throw new ServiceError(422, "Las incidencias de referencia deben existir en el mismo proyecto");
        }
        if ((prev && !prev.rank) || (next && !next.rank)) {
          throw new ServiceError(409, "El orden cambió; recarga la página e inténtalo de nuevo");
        }
        if (prev?.rank && next?.rank && prev.rank >= next.rank) {
          throw new ServiceError(409, "El orden cambió; recarga la página e inténtalo de nuevo");
        }

        // Si otro movimiento ya ocupó el hueco, la clave se genera antes de
        // la que hay ahora (no entre los vecinos originales), así que no choca.
        const lower = prev?.rank ?? null;
        let upper = next?.rank ?? null;
        const successor = await tx.issue.findFirst({
          where: { projectId: issue.projectId, id: { not: issueId }, rank: { gt: lower ?? "" } },
          orderBy: { rank: "asc" },
          select: { rank: true },
        });
        if (successor?.rank && (upper === null || successor.rank < upper)) upper = successor.rank;

        const key = generateKeyBetween(lower, upper);
        return tx.issue.update({ where: { id: issueId }, data: { rank: key } });
      });
    } catch (e) {
      if (isUniqueViolation(e) && attempt < MAX_ATTEMPTS) continue;
      if (isUniqueViolation(e)) throw new ServiceError(409, "Demasiados reordenamientos a la vez; inténtalo de nuevo");
      throw e;
    }
  }
  throw new ServiceError(409, "No se pudo reordenar");
}
