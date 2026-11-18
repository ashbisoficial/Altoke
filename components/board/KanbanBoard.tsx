"use client";

import { useMemo, useState } from "react";
import { ListFilter } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { IssueCard, type BoardIssue, type StatusTarget } from "./IssueCard";
import { PRIORITY_LABEL, PRIORITY_ORDER } from "@/lib/priority";

const UNASSIGNED = "__sin_asignar__";

export type BoardStatus = {
  id: string;
  name: string;
  color: string;
  order: number;
};

function Column({
  status,
  issues,
  allIssueIds,
  targets,
  onMoveTo,
  onStep,
}: {
  status: BoardStatus;
  issues: BoardIssue[];
  allIssueIds: string[];
  targets: StatusTarget[];
  onMoveTo: (issueId: string, statusId: string) => void;
  onStep: (issueId: string, delta: -1 | 1) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border"
      style={{ backgroundColor: `${status.color}0d` }}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: `${status.color}33` }}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="truncate font-heading text-sm font-semibold">{status.name}</h3>
        <span
          className="ml-auto shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-xs text-ink/50"
        >
          {issues.length}
        </span>
      </div>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl border-2 border-dashed p-2 transition-colors ${
            isOver ? "border-accent bg-accent/5" : "border-transparent"
          }`}
        >
          {issues.map((issue) => {
            const pos = allIssueIds.indexOf(issue.id);
            return (
              <IssueCard
                key={issue.id}
                issue={issue}
                targets={targets.filter((t) => t.id !== status.id)}
                canMoveUp={pos > 0}
                canMoveDown={pos >= 0 && pos < allIssueIds.length - 1}
                onMoveTo={(statusId) => onMoveTo(issue.id, statusId)}
                onStep={(delta) => onStep(issue.id, delta)}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  statuses,
  initialIssues,
}: {
  statuses: BoardStatus[];
  initialIssues: BoardIssue[];
}) {
  const [issues, setIssues] = useState(initialIssues);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) {
      if (issue.assignee) map.set(issue.assignee.email, issue.assignee.name ?? issue.assignee.email);
    }
    return Array.from(map.entries());
  }, [issues]);

  const typeOptions = useMemo(
    () => Array.from(new Set(issues.map((i) => i.issueType.name))),
    [issues],
  );

  const hasActiveFilters = assigneeFilter !== "all" || typeFilter !== "all" || priorityFilter !== "all";

  const visibleIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (assigneeFilter === UNASSIGNED && issue.assignee) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== UNASSIGNED && issue.assignee?.email !== assigneeFilter)
        return false;
      if (typeFilter !== "all" && issue.issueType.name !== typeFilter) return false;
      if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
      return true;
    });
  }, [issues, assigneeFilter, typeFilter, priorityFilter]);

  const issuesByStatus = useMemo(() => {
    const map = new Map<string, BoardIssue[]>();
    for (const status of statuses) map.set(status.id, []);
    for (const issue of visibleIssues) map.get(issue.statusId)?.push(issue);
    return map;
  }, [visibleIssues, statuses]);

  const activeIssue = activeId ? issues.find((i) => i.id === activeId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setError(null);
  }

  // Orden completo por columna (sin filtros): de ahí salen los vecinos de rank.
  const columnIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      const list = map.get(issue.statusId) ?? [];
      list.push(issue.id);
      map.set(issue.statusId, list);
    }
    return map;
  }, [issues]);

  const statusTargets: StatusTarget[] = statuses.map((s) => ({ id: s.id, name: s.name }));

  /**
   * Único punto de entrada para mover una tarjeta: arrastre, selector y
   * botones. Primero cambia de estado (la transición valida el workflow) y
   * después la coloca en `index` dentro de la columna (sin contar la propia).
   */
  async function placeIssue(issueId: string, targetStatusId: string, index: number | "end") {
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;
    const others = issues.filter((i) => i.id !== issueId && i.statusId === targetStatusId);
    const at = index === "end" ? others.length : Math.max(0, Math.min(index, others.length));
    const previous = others[at - 1]?.id ?? null;
    const next = others[at]?.id ?? null;

    const sameColumn = issue.statusId === targetStatusId;
    const fromIdx = (columnIds.get(targetStatusId) ?? []).indexOf(issueId);
    if (sameColumn && fromIdx === at) return;

    const snapshot = issues;
    const rest = issues.filter((i) => i.id !== issueId);
    const anchor = previous
      ? rest.findIndex((i) => i.id === previous) + 1
      : next
        ? rest.findIndex((i) => i.id === next)
        : rest.length;
    rest.splice(anchor, 0, { ...issue, statusId: targetStatusId });
    setIssues(rest);
    setError(null);

    const fail = async (res: Response) => {
      setIssues(snapshot);
      const body = await res.json().catch(() => ({}));
      setError(body.error?.message ?? body.error ?? "No se pudo mover la incidencia");
    };

    if (!sameColumn) {
      const res = await fetch(`/api/issues/${issueId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toStatusId: targetStatusId }),
      });
      if (!res.ok) return fail(res);
    }

    const res = await fetch(`/api/issues/${issueId}/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousId: previous, nextId: next }),
    });
    if (!res.ok) return fail(res);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issue = issues.find((i) => i.id === active.id);
    if (!issue) return;

    const overId = String(over.id);
    if (statuses.some((s) => s.id === overId)) {
      return placeIssue(issue.id, overId, "end");
    }

    const overIssue = issues.find((i) => i.id === overId);
    if (!overIssue) return;
    const target = overIssue.statusId;
    const fullList = columnIds.get(target) ?? [];
    const fromIdx = fullList.indexOf(issue.id);
    const fullOverIdx = fullList.indexOf(overId);
    const others = issues.filter((i) => i.id !== issue.id && i.statusId === target);
    const overIdx = others.findIndex((i) => i.id === overId);
    const movingDown = issue.statusId === target && fromIdx !== -1 && fromIdx < fullOverIdx;
    return placeIssue(issue.id, target, movingDown ? overIdx + 1 : overIdx);
  }

  function stepIssue(issueId: string, delta: -1 | 1) {
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;
    const list = columnIds.get(issue.statusId) ?? [];
    const pos = list.indexOf(issueId);
    const target = pos + delta;
    if (target < 0 || target >= list.length) return;
    return placeIssue(issueId, issue.statusId, target);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListFilter size={14} className="shrink-0 text-ink/40" />
        <select
          data-testid="board-filter-assignee-select"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
        >
          <option value="all">Todas las personas</option>
          <option value={UNASSIGNED}>Sin asignar</option>
          {assigneeOptions.map(([email, name]) => (
            <option key={email} value={email}>
              {name}
            </option>
          ))}
        </select>
        <select
          data-testid="board-filter-type-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
        >
          <option value="all">Todos los tipos</option>
          {typeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          data-testid="board-filter-priority-select"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
        >
          <option value="all">Toda prioridad</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            type="button"
            data-testid="board-filter-clear-button"
            onClick={() => {
              setAssigneeFilter("all");
              setTypeFilter("all");
              setPriorityFilter("all");
            }}
            className="text-xs text-accent hover:underline underline-offset-4"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className="grid gap-2 sm:gap-4"
          style={{ gridTemplateColumns: `repeat(${Math.max(statuses.length, 1)}, minmax(0, 1fr))` }}
        >
          {statuses.map((status) => (
            <Column
              key={status.id}
              status={status}
              issues={issuesByStatus.get(status.id) ?? []}
              allIssueIds={columnIds.get(status.id) ?? []}
              targets={statusTargets}
              onMoveTo={(issueId, statusId) => placeIssue(issueId, statusId, "end")}
              onStep={stepIssue}
            />
          ))}
        </div>
        <DragOverlay>
          {activeIssue ? (
            <IssueCard
              issue={activeIssue}
              targets={statusTargets}
              canMoveUp={false}
              canMoveDown={false}
              onMoveTo={() => {}}
              onStep={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
