"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ListFilter, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BacklogRow, type BacklogIssue } from "./BacklogRow";

const UNASSIGNED = "__sin_asignar__";

export type BacklogSprint = {
  id: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  startDate: string | null;
  endDate: string | null;
};

const SPRINT_STATUS_LABEL: Record<BacklogSprint["status"], string> = {
  PLANNED: "Planeado",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
};

function toDateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function Section({
  id,
  title,
  right,
  issues,
  progress,
}: {
  id: string;
  title: string;
  right?: React.ReactNode;
  issues: BacklogIssue[];
  progress?: { done: number; total: number };
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="mb-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        <span className="text-xs text-ink/50">{issues.length}</span>
        {progress && progress.total > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-ink/50">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-bg">
              <span
                className="block h-full rounded-full bg-status-done transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </span>
            {progress.done} de {progress.total} completadas
          </span>
        )}
        <div className="ml-auto">{right}</div>
      </div>
      <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-14 flex-col gap-1.5 rounded-lg border-2 border-dashed p-2 transition-colors ${
            isOver ? "border-accent bg-accent/5" : "border-transparent"
          }`}
        >
          {issues.length === 0 && (
            <p className="px-1 py-2 text-xs text-ink/40">Suelta incidencias aquí.</p>
          )}
          {issues.map((issue) => (
            <BacklogRow key={issue.id} issue={issue} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

export function BacklogBoard({
  projectId,
  sprints,
  initialIssues,
}: {
  projectId: string;
  sprints: BacklogSprint[];
  initialIssues: BacklogIssue[];
}) {
  const router = useRouter();
  const [issues, setIssues] = useState(initialIssues);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSprintName, setNewSprintName] = useState("");
  const [creatingSprint, setCreatingSprint] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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

  const hasActiveFilters = assigneeFilter !== "all" || typeFilter !== "all";

  const visibleIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (assigneeFilter === UNASSIGNED && issue.assignee) return false;
      if (assigneeFilter !== "all" && assigneeFilter !== UNASSIGNED && issue.assignee?.email !== assigneeFilter)
        return false;
      if (typeFilter !== "all" && issue.issueType.name !== typeFilter) return false;
      return true;
    });
  }, [issues, assigneeFilter, typeFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, BacklogIssue[]>();
    map.set("backlog", []);
    for (const sprint of sprints) map.set(sprint.id, []);
    for (const issue of visibleIssues) {
      const key = issue.sprintId ?? "backlog";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    }
    return map;
  }, [visibleIssues, sprints]);

  // El avance de cada sprint se calcula sobre todas sus incidencias, sin
  // aplicar los filtros de arriba — es una métrica del sprint completo,
  // no de lo que se está mirando en ese momento.
  const sprintProgress = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    for (const sprint of sprints) map.set(sprint.id, { done: 0, total: 0 });
    for (const issue of issues) {
      if (!issue.sprintId) continue;
      const entry = map.get(issue.sprintId);
      if (!entry) continue;
      entry.total += 1;
      if (issue.status.category === "DONE") entry.done += 1;
    }
    return map;
  }, [issues, sprints]);

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

    const containerIds = new Set(["backlog", ...sprints.map((s) => s.id)]);
    const overContainerId = containerIds.has(String(over.id))
      ? String(over.id)
      : issues.find((i) => i.id === over.id)?.sprintId ?? "backlog";

    const currentContainerId = issue.sprintId ?? "backlog";
    if (overContainerId === currentContainerId) return;

    const newSprintId = overContainerId === "backlog" ? null : overContainerId;
    setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, sprintId: newSprintId } : i)));

    const res = await fetch(`/api/issues/${issue.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprintId: newSprintId }),
    });
    if (!res.ok) {
      setIssues((prev) => prev.map((i) => (i.id === issue.id ? { ...i, sprintId: issue.sprintId } : i)));
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo mover la incidencia");
    }
  }

  async function createSprint(e: React.FormEvent) {
    e.preventDefault();
    if (!newSprintName.trim()) return;
    setCreatingSprint(true);
    const res = await fetch(`/api/projects/${projectId}/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSprintName.trim() }),
    });
    setCreatingSprint(false);
    if (res.ok) {
      setNewSprintName("");
      router.refresh();
    }
  }

  async function updateSprintStatus(sprintId: string, status: BacklogSprint["status"]) {
    await fetch(`/api/sprints/${sprintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function updateSprintDate(sprintId: string, field: "startDate" | "endDate", value: string) {
    await fetch(`/api/sprints/${sprintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value ? new Date(value).toISOString() : null }),
    });
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={createSprint} className="mb-4 flex gap-2">
        <input
          value={newSprintName}
          onChange={(e) => setNewSprintName(e.target.value)}
          placeholder="Nombre del nuevo sprint"
          className="w-64 rounded-md border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={creatingSprint}>
          <Plus size={14} />
          Sprint
        </Button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setAssigneeFilter("all");
              setTypeFilter("all");
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
        {sprints.map((sprint) => (
          <Section
            key={sprint.id}
            id={sprint.id}
            title={sprint.name}
            issues={groups.get(sprint.id) ?? []}
            progress={sprintProgress.get(sprint.id)}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink/50">{SPRINT_STATUS_LABEL[sprint.status]}</span>
                <label className="flex items-center gap-1 text-xs text-ink/50">
                  Del
                  <input
                    type="date"
                    value={toDateInputValue(sprint.startDate)}
                    onChange={(e) => updateSprintDate(sprint.id, "startDate", e.target.value)}
                    className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-ink/50">
                  al
                  <input
                    type="date"
                    value={toDateInputValue(sprint.endDate)}
                    onChange={(e) => updateSprintDate(sprint.id, "endDate", e.target.value)}
                    className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  />
                </label>
                {sprint.status === "PLANNED" && (
                  <Button variant="ghost" onClick={() => updateSprintStatus(sprint.id, "ACTIVE")}>
                    Iniciar
                  </Button>
                )}
                {sprint.status === "ACTIVE" && (
                  <Button variant="ghost" onClick={() => updateSprintStatus(sprint.id, "COMPLETED")}>
                    Completar
                  </Button>
                )}
              </div>
            }
          />
        ))}
        <Section id="backlog" title="Backlog" issues={groups.get("backlog") ?? []} />
        <DragOverlay>{activeIssue ? <BacklogRow issue={activeIssue} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
