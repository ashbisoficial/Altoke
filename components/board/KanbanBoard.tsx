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
import { IssueCard, type BoardIssue } from "./IssueCard";
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
}: {
  status: BoardStatus;
  issues: BoardIssue[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-bg">
      <div className="flex items-center gap-2 px-2 py-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: status.color }} />
        <h3 className="truncate font-heading text-sm font-semibold">{status.name}</h3>
        <span className="ml-auto shrink-0 text-xs text-ink/50">{issues.length}</span>
      </div>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg border-2 border-dashed p-2 transition-colors ${
            isOver ? "border-accent bg-accent/5" : "border-transparent"
          }`}
        >
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
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

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issue = issues.find((i) => i.id === active.id);
    if (!issue) return;

    // `over` may be another card (find its column) or a column itself.
    const overStatusId = statuses.some((s) => s.id === over.id)
      ? String(over.id)
      : issues.find((i) => i.id === over.id)?.statusId;

    if (!overStatusId || overStatusId === issue.statusId) return;

    const previousStatusId = issue.statusId;
    setIssues((prev) =>
      prev.map((i) => (i.id === issue.id ? { ...i, statusId: overStatusId } : i)),
    );

    const res = await fetch(`/api/issues/${issue.id}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toStatusId: overStatusId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setIssues((prev) =>
        prev.map((i) => (i.id === issue.id ? { ...i, statusId: previousStatusId } : i)),
      );
      setError(body.error ?? "No se pudo mover la incidencia");
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ListFilter size={14} className="shrink-0 text-ink/40" />
        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
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
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
        >
          <option value="all">Todos los tipos</option>
          {typeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs"
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
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
            <Column key={status.id} status={status} issues={issuesByStatus.get(status.id) ?? []} />
          ))}
        </div>
        <DragOverlay>{activeIssue ? <IssueCard issue={activeIssue} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
