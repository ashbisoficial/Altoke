import { PrismaClient } from "@prisma/client";

/**
 * Cliente de Prisma con borrado lógico (F0-8).
 *
 * Para los modelos con `deletedAt`, cualquier lectura o actualización masiva
 * excluye los registros borrados por defecto. Así un listado, una búsqueda o
 * un detalle nunca muestran una incidencia borrada, aunque la consulta no lo
 * recuerde. Para ver o restaurar lo borrado, la consulta debe nombrar
 * `deletedAt` en su `where` (por ejemplo `{ deletedAt: { not: null } }`); en
 * ese caso la extensión no añade el filtro.
 */

const SOFT_DELETE_MODELS = new Set(["Issue", "Comment", "TestCase"]);
const FILTERED_OPERATIONS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

function excludeDeleted(args: Record<string, unknown> | undefined) {
  const next = { ...(args ?? {}) } as Record<string, unknown>;
  const where = { ...((next.where as Record<string, unknown> | undefined) ?? {}) };
  if (!("deletedAt" in where)) where.deletedAt = null;
  next.where = where;
  return next;
}

function createExtendedClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (SOFT_DELETE_MODELS.has(model) && FILTERED_OPERATIONS.has(operation)) {
            return query(excludeDeleted(args as Record<string, unknown>) as typeof args);
          }
          return query(args);
        },
      },
    },
  });
}

type ExtendedClient = ReturnType<typeof createExtendedClient>;

const globalForPrisma = globalThis as unknown as { prisma: ExtendedClient | undefined };

export const prisma: ExtendedClient = globalForPrisma.prisma ?? createExtendedClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** Cliente de transacción del cliente extendido; úsalo en funciones que reciben `tx`. */
export type DbTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
