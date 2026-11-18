import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/issue-service";

/**
 * Ciclo de vida de un sprint (F0-6).
 *
 *  - Iniciar: solo desde PLANNED, con fechas de inicio y fin válidas, y
 *    como máximo un sprint ACTIVE por proyecto. La regla se aplica también
 *    en la base (índice parcial único, ver la migración
 *    `sprint_single_active_per_project`) para que dos peticiones simultáneas
 *    no puedan activar dos sprints.
 *  - Completar: solo desde ACTIVE. Las incidencias sin terminar salen del
 *    sprint, a backlog o a un sprint planeado que el usuario elige. Las
 *    terminadas se quedan en el sprint como historial.
 */

export const completeSprintInput = z
  .object({
    target: z.enum(["BACKLOG", "NEXT_SPRINT"]).default("BACKLOG"),
    nextSprintId: z.string().min(1).optional(),
  })
  .refine((v) => v.target !== "NEXT_SPRINT" || !!v.nextSprintId, {
    message: "nextSprintId es obligatorio cuando target es NEXT_SPRINT",
    path: ["nextSprintId"],
  });

export type CompleteSprintInput = z.infer<typeof completeSprintInput>;

/** Lanza 422 si la fecha de fin no es posterior a la de inicio. */
export function assertValidSprintDates(startDate: Date | null, endDate: Date | null) {
  if (startDate && endDate && endDate <= startDate) {
    throw new ServiceError(422, "La fecha de fin debe ser posterior a la de inicio");
  }
}

export async function startSprint(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw new ServiceError(404, "Sprint no encontrado");
  if (sprint.status !== "PLANNED") {
    throw new ServiceError(409, `Solo se puede iniciar un sprint planeado (estado actual: ${sprint.status})`);
  }
  if (!sprint.startDate || !sprint.endDate) {
    throw new ServiceError(422, "El sprint necesita fecha de inicio y de fin para iniciarse");
  }
  assertValidSprintDates(sprint.startDate, sprint.endDate);

  try {
    // updateMany con la condición de estado: si otra petición ya lo cambió,
    // count es 0 y no se activa dos veces.
    const { count } = await prisma.sprint.updateMany({
      where: { id: sprintId, status: "PLANNED" },
      data: { status: "ACTIVE" },
    });
    if (count === 0) throw new ServiceError(409, "El sprint cambió de estado mientras se iniciaba; vuelve a intentarlo");
  } catch (e) {
    if (isActiveSprintConflict(e)) {
      throw new ServiceError(409, "Ya hay un sprint activo en este proyecto; complétalo antes de iniciar otro");
    }
    throw e;
  }

  return prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
}

export async function completeSprint(actorId: string, sprintId: string, input: CompleteSprintInput) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) throw new ServiceError(404, "Sprint no encontrado");
  if (sprint.status !== "ACTIVE") {
    throw new ServiceError(409, `Solo se puede completar un sprint activo (estado actual: ${sprint.status})`);
  }

  let destinationName = "Backlog";
  if (input.target === "NEXT_SPRINT") {
    const next = await prisma.sprint.findUnique({ where: { id: input.nextSprintId! } });
    if (!next || next.projectId !== sprint.projectId) {
      throw new ServiceError(422, "El sprint de destino no existe en este proyecto");
    }
    if (next.status !== "PLANNED") {
      throw new ServiceError(422, "Las incidencias solo pueden pasar a un sprint planeado");
    }
    destinationName = next.name;
  }
  const destinationId = input.target === "NEXT_SPRINT" ? input.nextSprintId! : null;

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.sprint.updateMany({
      where: { id: sprintId, status: "ACTIVE" },
      data: { status: "COMPLETED" },
    });
    if (count === 0) throw new ServiceError(409, "El sprint ya no está activo");

    const unfinished = await tx.issue.findMany({
      where: { sprintId, status: { category: { not: "DONE" } } },
      select: { id: true },
    });

    if (unfinished.length > 0) {
      await tx.issue.updateMany({
        where: { id: { in: unfinished.map((i) => i.id) } },
        data: { sprintId: destinationId },
      });
      await tx.issueActivity.createMany({
        data: unfinished.map((i) => ({
          issueId: i.id,
          actorId,
          field: "sprint",
          fromLabel: sprint.name,
          toLabel: destinationName,
        })),
      });
    }

    return {
      sprint: await tx.sprint.findUniqueOrThrow({ where: { id: sprintId } }),
      movedIssues: unfinished.length,
      destination: destinationName,
    };
  });
}

function isActiveSprintConflict(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
