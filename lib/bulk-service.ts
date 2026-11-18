import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ServiceError, labelNamesOf, recordLabelChange, transitionIssue, updateIssue } from "@/lib/issue-service";
import { PRIORITIES } from "@/lib/issue-query";

/**
 * Edición masiva (F1-4). Cada incidencia se procesa por separado con las
 * mismas funciones que usan las rutas individuales, así que las mismas reglas
 * aplican (transiciones del flujo, historial, notificaciones). Un fallo en una
 * incidencia no afecta a las demás, y el resultado dice cuáles fallaron y por qué.
 */

export const MAX_BULK = 200;

export const bulkInput = z.object({
  issueIds: z.array(z.string().min(1)).min(1).max(MAX_BULK),
  action: z.discriminatedUnion("type", [
    z.object({ type: z.literal("status"), statusId: z.string().min(1) }),
    z.object({ type: z.literal("assignee"), assigneeId: z.string().min(1).nullable() }),
    z.object({ type: z.literal("sprint"), sprintId: z.string().min(1).nullable() }),
    z.object({ type: z.literal("priority"), priority: z.enum(PRIORITIES) }),
    z.object({ type: z.literal("label_add"), labelId: z.string().min(1) }),
    z.object({ type: z.literal("label_remove"), labelId: z.string().min(1) }),
  ]),
});

export type BulkAction = z.infer<typeof bulkInput>["action"];

export type BulkResult = { id: string; key: string | null; ok: boolean; error?: string };

/** Permiso que exige cada acción. */
export function permissionFor(action: BulkAction) {
  return action.type === "status" ? "issue.transition" : "issue.edit";
}

async function applyOne(actorId: string, projectId: string, issueId: string, action: BulkAction) {
  switch (action.type) {
    case "status":
      await transitionIssue(actorId, issueId, action.statusId);
      return;
    case "assignee":
      await updateIssue(actorId, issueId, { assigneeId: action.assigneeId });
      return;
    case "sprint":
      await updateIssue(actorId, issueId, { sprintId: action.sprintId });
      return;
    case "priority":
      await updateIssue(actorId, issueId, { priority: action.priority });
      return;
    case "label_add":
    case "label_remove": {
      const label = await prisma.label.findUnique({ where: { id: action.labelId }, select: { projectId: true } });
      if (!label || label.projectId !== projectId) throw new ServiceError(422, "La etiqueta no pertenece a este proyecto");
      const before = await labelNamesOf(issueId);
      if (action.type === "label_add") {
        await prisma.issueLabel.upsert({
          where: { issueId_labelId: { issueId, labelId: action.labelId } },
          update: {},
          create: { issueId, labelId: action.labelId },
        });
      } else {
        await prisma.issueLabel.deleteMany({ where: { issueId, labelId: action.labelId } });
      }
      await recordLabelChange(actorId, issueId, before, await labelNamesOf(issueId));
      return;
    }
  }
}

export async function runBulk(actorId: string, projectId: string, issueIds: string[], action: BulkAction): Promise<BulkResult[]> {
  const rows = await prisma.issue.findMany({
    where: { id: { in: issueIds } },
    select: { id: true, key: true, projectId: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const results: BulkResult[] = [];
  for (const id of issueIds) {
    const row = byId.get(id);
    if (!row || row.projectId !== projectId) {
      results.push({ id, key: row?.key ?? null, ok: false, error: "La incidencia no existe en este proyecto" });
      continue;
    }
    try {
      await applyOne(actorId, projectId, id, action);
      results.push({ id, key: row.key, ok: true });
    } catch (e) {
      const message = e instanceof ServiceError ? e.message : "Error inesperado";
      if (!(e instanceof ServiceError)) console.error("bulk item failed", id, e);
      results.push({ id, key: row.key, ok: false, error: message });
    }
  }
  return results;
}
