"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
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
  status: { id: string; name: string; color: string; category: string };
  assignee: { name: string | null; email: string } | null;
  sprintName: string | null;
};

export type BulkOptions = {
  statuses: { id: string; name: string }[];
  sprints: { id: string; name: string }[];
  labels: { id: string; name: string }[];
  people: { id: string; name: string }[];
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

type BulkType = "status" | "assignee" | "sprint" | "priority" | "label_add" | "label_remove";

const BULK_LABEL: Record<BulkType, string> = {
  status: "Cambiar estado",
  assignee: "Asignar a",
  sprint: "Mover a sprint",
  priority: "Cambiar prioridad",
  label_add: "Añadir etiqueta",
  label_remove: "Quitar etiqueta",
};

const PRIORITY_OPTIONS: Priority[] = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"];

/**
 * Tabla de la lista con selección y edición masiva (F1-4). Cada operación
 * devuelve el resultado por incidencia; los fallos muestran su motivo.
 */
export function IssueTable({
  projectId,
  issues,
  columns,
  sort,
  sortLinks,
  options,
}: {
  projectId: string;
  issues: ListIssue[];
  columns: Column[];
  sort: ParsedListQuery["sort"];
  sortLinks: Record<string, string>;
  options: BulkOptions;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkType, setBulkType] = useState<BulkType>("status");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ succeeded: number; failed: { key: string | null; error?: string }[] } | null>(null);

  const allIds = useMemo(() => issues.map((i) => i.id), [issues]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  /** Construye la acción según el tipo elegido y el valor del selector. */
  function buildAction(): Record<string, unknown> | null {
    switch (bulkType) {
      case "status": return value ? { type: "status", statusId: value } : null;
      case "assignee": return { type: "assignee", assigneeId: value || null };
      case "sprint": return { type: "sprint", sprintId: value || null };
      case "priority": return value ? { type: "priority", priority: value } : null;
      case "label_add": return value ? { type: "label_add", labelId: value } : null;
      case "label_remove": return value ? { type: "label_remove", labelId: value } : null;
    }
  }

  async function apply() {
    const action = buildAction();
    if (!action || selected.size === 0) return;
    setBusy(true);
    setReport(null);
    const res = await fetch(`/api/projects/${projectId}/issues/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueIds: [...selected], action }),
    });
    setBusy(false);
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setReport({ succeeded: 0, failed: [{ key: null, error: data?.error ?? "No se pudo aplicar la acción" }] });
      return;
    }
    const failed = (data.results as { key: string | null; ok: boolean; error?: string }[]).filter((r) => !r.ok);
    setReport({ succeeded: data.succeeded, failed });
    setSelected(new Set());
    router.refresh();
  }

  const valueOptions: { id: string; name: string }[] = (() => {
    switch (bulkType) {
      case "status": return options.statuses;
      case "assignee": return [{ id: "", name: "Sin asignar" }, ...options.people];
      case "sprint": return [{ id: "", name: "Backlog" }, ...options.sprints];
      case "priority": return PRIORITY_OPTIONS.map((p) => ({ id: p, name: PRIORITY_LABEL[p] }));
      case "label_add":
      case "label_remove": return options.labels;
    }
  })();

  if (issues.length === 0) {
    return <p className="text-sm text-ink/50" data-testid="issue-list-empty">No hay incidencias con esos filtros.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {selected.size > 0 && (
        <div className="shadow-soft flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-surface p-3 text-sm" data-testid="bulk-bar">
          <span className="font-medium">{selected.size} seleccionadas</span>
          <select value={bulkType} onChange={(e) => { setBulkType(e.target.value as BulkType); setValue(""); }} className="rounded-lg border border-border bg-bg px-2 py-1" data-testid="bulk-type-select">
            {(Object.keys(BULK_LABEL) as BulkType[]).map((t) => (
              <option key={t} value={t}>{BULK_LABEL[t]}</option>
            ))}
          </select>
          <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded-lg border border-border bg-bg px-2 py-1" data-testid="bulk-value-select" aria-label="Valor">
            <option value="">Elige…</option>
            {valueOptions.map((o) => (
              <option key={o.id || "none"} value={o.id}>{o.name}</option>
            ))}
          </select>
          <Button onClick={apply} disabled={busy || !buildAction()} data-testid="bulk-apply-button">
            {busy ? "Aplicando…" : "Aplicar"}
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-accent hover:underline" data-testid="bulk-clear-button">
            Quitar selección
          </button>
        </div>
      )}

      {report && (
        <div role="status" className="rounded-xl border border-border bg-surface p-3 text-sm" data-testid="bulk-report">
          <p className="font-medium">{report.succeeded} actualizadas{report.failed.length > 0 ? `, ${report.failed.length} no se pudieron cambiar` : ""}.</p>
          {report.failed.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-xs text-red-700">
              {report.failed.map((f, i) => (
                <li key={`${f.key}-${i}`}>{f.key ?? "Incidencia"}: {f.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="shadow-soft overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm" data-testid="issue-list-table">
          <thead className="border-b border-border text-xs text-ink/60">
            <tr>
              <th className="px-3 py-2">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Seleccionar todas" data-testid="issue-list-select-all" />
              </th>
              {columns.map((c) => {
                const field = SORTABLE[c];
                const active = field && sort?.field === field;
                return (
                  <th key={c} className="px-3 py-2 font-medium" aria-sort={active ? (sort?.dir === "asc" ? "ascending" : "descending") : undefined}>
                    {field && sortLinks[field] ? (
                      <a href={sortLinks[field]} className="hover:underline" data-testid={`issue-list-sort-${field}`}>
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
                <td className="px-3 py-2">
                  <input type="checkbox" checked={selected.has(issue.id)} onChange={() => toggle(issue.id)} aria-label={`Seleccionar ${issue.key}`} data-testid={`issue-list-select-${issue.key}`} />
                </td>
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
    </div>
  );
}
