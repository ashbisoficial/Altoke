import { z } from "zod";
import { pageParams } from "@/lib/api-v1";

/**
 * Contrato de la API v1 (F0-5). Los esquemas de entrada son los que usan las
 * rutas para validar; los de respuesta describen lo que devuelven. La
 * especificación OpenAPI (lib/api-v1-openapi.ts) se genera desde aquí, y
 * tests/api-v1-contract.integration.test.ts comprueba que las respuestas
 * reales cumplen estos esquemas.
 */

export { pageParams };

/** Filtros de GET /projects/:id/issues. Los nombres antiguos sprintId y assigneeId siguen aceptándose. */
export const issueFilters = z.object({
  status: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  assignee: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  sprint: z.string().min(1).optional(),
  sprintId: z.string().min(1).optional(),
  updatedSince: z.iso.datetime({ message: "updatedSince debe ser una fecha ISO 8601" }).optional(),
});

export const errorBody = z.object({
  error: z.object({
    code: z.enum([
      "unauthenticated",
      "key_expired",
      "insufficient_scope",
      "rate_limited",
      "forbidden",
      "not_found",
      "validation_failed",
      "invalid_cursor",
      "conflict",
      "internal_error",
    ]),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string()).optional()).optional(),
  }),
});

const named = z.object({ id: z.string(), name: z.string() });

export const issueSummary = z.object({
  id: z.string(),
  key: z.string(),
  number: z.number().int(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"]),
  projectId: z.string(),
  issueTypeId: z.string(),
  statusId: z.string(),
  reporterId: z.string(),
  assigneeId: z.string().nullable(),
  sprintId: z.string().nullable(),
  storyPoints: z.number().int().nullable(),
  dueDate: z.iso.datetime().nullable(),
  rank: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  issueType: z.object({ id: z.string(), name: z.string(), color: z.string().nullable() }).optional(),
  status: z.object({ id: z.string(), name: z.string(), color: z.string(), category: z.string() }).optional(),
  assignee: z.object({ id: z.string(), name: z.string().nullable(), email: z.string() }).nullable().optional(),
  reporter: z.object({ id: z.string(), name: z.string().nullable(), email: z.string() }).nullable().optional(),
});

export const issueListResponse = z.object({
  issues: z.array(issueSummary),
  nextCursor: z.string().nullable(),
});

export const issueResponse = z.object({ issue: issueSummary });

export const rankResponse = z.object({ issue: z.object({ id: z.string(), rank: z.string().nullable() }) });

export const projectListResponse = z.object({
  projects: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      name: z.string(),
      createdAt: z.iso.datetime(),
      organization: named,
      _count: z.object({ issues: z.number().int() }),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export const issueTypeListResponse = z.object({
  issueTypes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string().nullable(),
      isSubtask: z.boolean(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
