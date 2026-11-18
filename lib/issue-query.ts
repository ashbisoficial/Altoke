import type { Prisma } from "@prisma/client";

/**
 * Filtros, orden y columnas de la vista de lista (F1-3). La URL es la fuente
 * de verdad: el mismo enlace devuelve el mismo resultado para quien lo abre.
 *
 *   q          texto en título o clave
 *   status     id de estado (repetible)
 *   type       id de tipo (repetible)
 *   assignee   id de persona (repetible) o "none" (sin asignar)
 *   sprint     id de sprint (repetible) o "none" (backlog)
 *   priority   HIGHEST | HIGH | MEDIUM | LOW | LOWEST (repetible)
 *   label      id de etiqueta (repetible)
 *   cf.<id>    valor de un campo personalizado
 *   sort       campo, con "-" para descendente
 *   cols       columnas visibles (repetible)
 *   page       página, desde 1
 *
 * Los valores no reconocidos se ignoran; nunca producen un error.
 */

export const PRIORITIES = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"] as const;
export const PAGE_SIZE = 50;

export const COLUMNS = ["key", "title", "type", "status", "priority", "assignee", "sprint", "storyPoints", "dueDate", "updatedAt"] as const;
export type Column = (typeof COLUMNS)[number];
export const DEFAULT_COLUMNS: Column[] = ["key", "title", "status", "priority", "assignee", "updatedAt"];

export const SORT_FIELDS = ["key", "title", "status", "priority", "updatedAt", "createdAt", "dueDate", "rank"] as const;
type SortField = (typeof SORT_FIELDS)[number];

export type FieldDefLite = { id: string; name: string; type: string; options: string[] | null };

export type ParsedListQuery = {
  q: string;
  statuses: string[];
  types: string[];
  assignees: string[];
  sprints: string[];
  priorities: (typeof PRIORITIES)[number][];
  labels: string[];
  custom: Record<string, string>;
  sort: { field: SortField; dir: "asc" | "desc" } | null;
  columns: Column[];
  page: number;
};

const get = (sp: URLSearchParams, key: string) => (sp.get(key) ?? "").trim();
const getAll = (sp: URLSearchParams, key: string) => sp.getAll(key).map((v) => v.trim()).filter(Boolean);

export function parseListQuery(sp: URLSearchParams, defs: FieldDefLite[] = []): ParsedListQuery {
  const sortRaw = get(sp, "sort");
  const sortDir = sortRaw.startsWith("-") ? "desc" : "asc";
  const sortField = sortRaw.replace(/^-/, "");
  const sort = (SORT_FIELDS as readonly string[]).includes(sortField)
    ? { field: sortField as SortField, dir: sortDir as "asc" | "desc" }
    : null;

  const colsRaw = getAll(sp, "cols").filter((c): c is Column => (COLUMNS as readonly string[]).includes(c));
  const columns = colsRaw.length > 0 ? [...new Set(colsRaw)] : DEFAULT_COLUMNS;

  const custom: Record<string, string> = {};
  for (const def of defs) {
    const v = get(sp, `cf.${def.id}`);
    if (v) custom[def.id] = v;
  }

  const page = Math.max(1, Math.min(10000, Number.parseInt(get(sp, "page") || "1", 10) || 1));

  return {
    q: get(sp, "q").slice(0, 200),
    statuses: getAll(sp, "status"),
    types: getAll(sp, "type"),
    assignees: getAll(sp, "assignee"),
    sprints: getAll(sp, "sprint"),
    priorities: getAll(sp, "priority").filter((p): p is (typeof PRIORITIES)[number] => (PRIORITIES as readonly string[]).includes(p)),
    labels: getAll(sp, "label"),
    custom,
    sort,
    columns,
    page,
  };
}

/** Construye el WHERE de Prisma para la lista. Siempre filtra por proyecto. */
export function buildIssueWhere(projectId: string, q: ParsedListQuery, defs: FieldDefLite[]): Prisma.IssueWhereInput {
  const and: Prisma.IssueWhereInput[] = [];

  if (q.q) {
    and.push({
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { key: { contains: q.q, mode: "insensitive" } },
      ],
    });
  }
  if (q.statuses.length) and.push({ statusId: { in: q.statuses } });
  if (q.types.length) and.push({ issueTypeId: { in: q.types } });
  if (q.priorities.length) and.push({ priority: { in: q.priorities } });
  if (q.assignees.length) {
    const named = q.assignees.filter((a) => a !== "none");
    const or: Prisma.IssueWhereInput[] = [];
    if (named.length) or.push({ assigneeId: { in: named } });
    if (q.assignees.includes("none")) or.push({ assigneeId: null });
    and.push({ OR: or });
  }
  if (q.sprints.length) {
    const named = q.sprints.filter((s) => s !== "none");
    const or: Prisma.IssueWhereInput[] = [];
    if (named.length) or.push({ sprintId: { in: named } });
    if (q.sprints.includes("none")) or.push({ sprintId: null });
    and.push({ OR: or });
  }
  if (q.labels.length) and.push({ labels: { some: { labelId: { in: q.labels } } } });

  for (const def of defs) {
    const value = q.custom[def.id];
    if (value === undefined) continue;
    if (def.type === "MULTI_SELECT") {
      and.push({ customFields: { path: [def.id], array_contains: [value] } });
    } else if (def.type === "NUMBER") {
      const n = Number(value);
      if (Number.isFinite(n)) and.push({ customFields: { path: [def.id], equals: n } });
    } else if (def.type === "TEXT") {
      and.push({ customFields: { path: [def.id], string_contains: value } });
    } else {
      and.push({ customFields: { path: [def.id], equals: value } });
    }
  }

  return { projectId, AND: and };
}

/** Orden de Prisma. Siempre termina en id para que la paginación sea estable. */
export function buildIssueOrder(sort: ParsedListQuery["sort"]): Prisma.IssueOrderByWithRelationInput[] {
  const dir = sort?.dir ?? "asc";
  const field = sort?.field;
  const primary: Prisma.IssueOrderByWithRelationInput = (() => {
    switch (field) {
      case "title": return { title: dir };
      case "status": return { status: { order: dir } };
      case "priority": return { priority: dir };
      case "updatedAt": return { updatedAt: dir };
      case "createdAt": return { createdAt: dir };
      case "dueDate": return { dueDate: dir };
      case "rank": return { rank: dir };
      case "key": return { number: dir };
      default: return { rank: "asc" };
    }
  })();
  return [primary, { id: "asc" }];
}

/** Query string para la URL, sin la página (así un filtro guardado no fija la página). */
export function filterQueryString(sp: URLSearchParams): string {
  const out = new URLSearchParams();
  for (const [key, value] of sp.entries()) {
    if (key === "page" || !value.trim()) continue;
    out.append(key, value);
  }
  return out.toString();
}
