import Link from "next/link";
import { type Column, type ParsedListQuery } from "@/lib/issue-query";
import { PRIORITY_LABEL, type Priority } from "@/lib/priority";

export type ListIssue = {
  id: string;
  key: string;
  title: string;
  priority: Priority;
  storyPoints: number | null;
  dueDate: string | null;
  updatedAt: string;
  issueType: { name: string; color: string | null };
  status: { name: string; color: string; category: string };
  assignee: { name: string | null; email: string } | null;
  sprintName: string | null;
};

const HEADER: Record<Column, string> = {
  key: "Clave",
  title: "Título",
  type: "Tipo",
  status: "Estado",
  priority: "Prioridad",
  assignee: "Asignado",
  sprint: "Sprint",
  storyPoints: "Puntos",
  dueDate: "Fecha límite",
  updatedAt: "Actualizada",
};

/** Columnas que se pueden ordenar, y el campo de orden que usan. */
const SORTABLE: Partial<Record<Column, string>> = {
  key: "key",
  title: "title",
  status: "status",
  priority: "priority",
  dueDate: "dueDate",
  updatedAt: "updatedAt",
};

function cell(column: Column, issue: ListIssue) {
  switch (column) {
    case "key":
      return <span className="font-mono text-xs text-accent">{issue.key}</span>;
    case "title":
      return (
        <Link href={`/issues/${issue.id}`} className="hover:underline">
          {issue.title}
        </Link>
      );
    case "type":
      return (
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }} />
          {issue.issueType.name}
        </span>
      );
    case "status":
      return (
        <span className="rounded-full px-2 py-0.5 text-white" style={{ backgroundColor: issue.status.color }}>
          {issue.status.name}
        </span>
      );
    case "priority":
      return PRIORITY_LABEL[issue.priority];
    case "assignee":
      return issue.assignee ? (issue.assignee.name ?? issue.assignee.email) : <span className="text-ink/40">Sin asignar</span>;
    case "sprint":
      return issue.sprintName ?? <span className="text-ink/40">Backlog</span>;
    case "storyPoints":
      return issue.storyPoints ?? <span className="text-ink/40">—</span>;
    case "dueDate":
      return issue.dueDate ? issue.dueDate.slice(0, 10) : <span className="text-ink/40">—</span>;
    case "updatedAt":
      return new Date(issue.updatedAt).toLocaleDateString("es", { day: "numeric", month: "short" });
  }
}

/**
 * Tabla de incidencias. Los encabezados ordenables son enlaces: cada clic
 * cambia el orden y deja la URL como filtro compartible.
 */
export function IssueTable({
  issues,
  columns,
  sort,
  sortHref,
}: {
  issues: ListIssue[];
  columns: Column[];
  sort: ParsedListQuery["sort"];
  sortHref: (field: string) => string;
}) {
  if (issues.length === 0) {
    return <p className="text-sm text-ink/50" data-testid="issue-list-empty">No hay incidencias con esos filtros.</p>;
  }

  return (
    <div className="shadow-soft overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm" data-testid="issue-list-table">
        <thead className="border-b border-border text-xs text-ink/60">
          <tr>
            {columns.map((c) => {
              const field = SORTABLE[c];
              const active = field && sort?.field === field;
              return (
                <th key={c} className="px-3 py-2 font-medium" aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}>
                  {field ? (
                    <a href={sortHref(field)} className="hover:underline" data-testid={`issue-list-sort-${field}`}>
                      {HEADER[c]}
                      {active ? (sort?.dir === "asc" ? " ↑" : " ↓") : ""}
                    </a>
                  ) : (
                    HEADER[c]
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id} className="border-t border-border" data-testid={`issue-list-row-${issue.key}`}>
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 align-middle">
                  {cell(c, issue)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
