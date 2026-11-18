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
import { BacklogRow, type BacklogIssue, type MoveTarget } from "./BacklogRow";

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

const SPRINT_STATUS_COLOR: Record<BacklogSprint["status"], string> = {
  PLANNED: "#7C3AED",
  ACTIVE: "#2952CC",
  COMPLETED: "#16A34A",
};

function toDateInputValue(iso: string | null) {
  return iso ? iso.slice(0, 10) : "";
}

function Section({
  id,
  title,
  right,
  issues,
  allIssueIds,
  targets,
  onMoveTo,
  onStep,
  progress,
  accentColor = "#94A3B8",
}: {
  id: string;
  title: string;
  right?: React.ReactNode;
  issues: BacklogIssue[];
  allIssueIds: string[];
  targets: MoveTarget[];
  onMoveTo: (issueId: string, containerId: string) => void;
  onStep: (issueId: string, delta: -1 | 1) => void;
  progress?: { done: number; total: number };
  accentColor?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const progressPct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="shadow-soft-hover mb-4 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="h-1.5" style={{ backgroundColor: accentColor }} />
      <div className="p-3">
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
            {issues.map((issue) => {
              const pos = allIssueIds.indexOf(issue.id);
              return (
                <BacklogRow
                  key={issue.id}
                  issue={issue}
                  targets={targets.filter((t) => t.id !== id)}
                  canMoveUp={pos > 0}
                  canMoveDown={pos >= 0 && pos < allIssueIds.length - 1}
                  onMoveTo={(containerId) => onMoveTo(issue.id, containerId)}
                  onStep={(delta) => onStep(issue.id, delta)}
                />
              );
            })}
          </div>
        </SortableContext>
      </div>
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
  const [sprintError, setSprintError] = useState<string | null>(null);
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

  // Orden completo de cada contenedor (sin filtros): de ahí salen los vecinos
  // de rank y si una incidencia puede subir o bajar.
  const groupIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of issues) {
      const key = issue.sprintId ?? "backlog";
      const list = map.get(key) ?? [];
      list.push(issue.id);
      map.set(key, list);
    }
    return map;
  }, [issues]);

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

  // Contenedores: "backlog" y cada sprint. Dentro de cada uno, el orden lo
  // da el rank de la base; `issues` ya llega y se mantiene en ese orden.
  const containerOf = (i: BacklogIssue) => i.sprintId ?? "backlog";
  const containerIdSet = new Set(["backlog", ...sprints.map((s) => s.id)]);
  const moveTargets = [{ id: "backlog", name: "Backlog" }, ...sprints.map((s) => ({ id: s.id, name: s.name }))];

  /**
   * Único punto de entrada para mover una incidencia: lo usan el arrastre,
   * el selector "Mover a…" y los botones de subir y bajar (F0-3).
   * `index` es la posición dentro del contenedor destino, sin contar la
   * propia incidencia. Usa los vecinos de la lista completa, no la filtrada.
   */
  async function placeIssue(issueId: string, targetContainerId: string, index: number | "end") {
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;
    const originalContainer = containerOf(issue);
    const others = issues.filter((i) => i.id !== issueId && containerOf(i) === targetContainerId);
    const at = index === "end" ? others.length : Math.max(0, Math.min(index, others.length));
    const previous = others[at - 1]?.id ?? null;
    const next = others[at]?.id ?? null;

    const unchanged =
      originalContainer === targetContainerId &&
      issues.filter((i) => containerOf(i) === targetContainerId).indexOf(issue) === at;
    if (unchanged) return;

    const snapshot = issues;
    const newSprintId = targetContainerId === "backlog" ? null : targetContainerId;
    // Actualización optimista: quitar y volver a insertar junto al vecino.
    const rest = issues.filter((i) => i.id !== issueId);
    const anchorIdx = previous
      ? rest.findIndex((i) => i.id === previous) + 1
      : next
        ? rest.findIndex((i) => i.id === next)
        : rest.length;
    rest.splice(anchorIdx, 0, { ...issue, sprintId: newSprintId });
    setIssues(rest);
    setError(null);

    if (originalContainer !== targetContainerId) {
      const res = await fetch(`/api/issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprintId: newSprintId }),
      });
      if (!res.ok) return rollback(snapshot, res);
    }

    const res = await fetch(`/api/issues/${issueId}/rank`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousId: previous, nextId: next }),
    });
    if (!res.ok) return rollback(snapshot, res);
    router.refresh();
  }

  async function rollback(snapshot: BacklogIssue[], res: Response) {
    setIssues(snapshot);
    const data = await res.json().catch(() => ({}));
    setError(data.error?.message ?? data.error ?? "No se pudo mover la incidencia");
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issue = issues.find((i) => i.id === active.id);
    if (!issue) return;

    const overId = String(over.id);
    if (containerIdSet.has(overId)) {
      return placeIssue(issue.id, overId, "end");
    }

    const overIssue = issues.find((i) => i.id === overId);
    if (!overIssue) return;
    const target = containerOf(overIssue);
    const others = issues.filter((i) => i.id !== issue.id && containerOf(i) === target);
    const overIdx = others.findIndex((i) => i.id === overId);

    // Mismo contenedor: si baja, se coloca después de la incidencia de destino.
    const fullList = issues.filter((i) => containerOf(i) === target);
    const fromIdx = fullList.findIndex((i) => i.id === issue.id);
    const fullOverIdx = fullList.findIndex((i) => i.id === overId);
    const movingDown = containerOf(issue) === target && fromIdx !== -1 && fromIdx < fullOverIdx;
    return placeIssue(issue.id, target, movingDown ? overIdx + 1 : overIdx);
  }

  /** Subir o bajar una posición dentro de su contenedor (alternativa al arrastre). */
  function stepIssue(issueId: string, delta: -1 | 1) {
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;
    const list = issues.filter((i) => containerOf(i) === containerOf(issue));
    const pos = list.findIndex((i) => i.id === issueId);
    const target = pos + delta;
    if (target < 0 || target >= list.length) return;
    // Índice sin contar la propia incidencia: con delta +1 queda después del vecino.
    return placeIssue(issueId, containerOf(issue), target);
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

  // Iniciar y completar tienen reglas en el servidor (un solo sprint activo,
  // fechas válidas, incidencias sin terminar movidas). Si lo rechaza, se
  // muestra el motivo en lugar de ignorarlo.
  async function runSprintAction(sprintId: string, action: "start" | "complete") {
    setSprintError(null);
    const res = await fetch(`/api/sprints/${sprintId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSprintError(data?.error ?? "No se pudo cambiar el estado del sprint");
      return;
    }
    router.refresh();
  }

  async function updateSprintDate(sprintId: string, field: "startDate" | "endDate", value: string) {
    setSprintError(null);
    const res = await fetch(`/api/sprints/${sprintId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value ? new Date(value).toISOString() : null }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSprintError(data?.error ?? "No se pudo guardar la fecha");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {sprintError && (
        <p role="alert" className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {sprintError}
        </p>
      )}
      <form onSubmit={createSprint} className="mb-4 flex gap-2">
        <input
          value={newSprintName}
          onChange={(e) => setNewSprintName(e.target.value)}
          placeholder="Nombre del nuevo sprint" data-testid="backlog-sprint-name-input"
          className="w-64 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm"
        />
        <Button type="submit" variant="secondary" disabled={creatingSprint} data-testid="backlog-sprint-create-button">
          <Plus size={14} />
          Sprint
        </Button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ListFilter size={14} className="shrink-0 text-ink/40" />
        <select
          data-testid="backlog-filter-assignee-select"
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
          data-testid="backlog-filter-type-select"
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
        {hasActiveFilters && (
          <button
            type="button"
            data-testid="backlog-filter-clear-button"
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
        {sprints.map((sprint) => (
          <Section
            key={sprint.id}
            id={sprint.id}
            title={sprint.name}
            issues={groups.get(sprint.id) ?? []}
            allIssueIds={groupIds.get(sprint.id) ?? []}
            targets={moveTargets}
            onMoveTo={(issueId, containerId) => placeIssue(issueId, containerId, "end")}
            onStep={stepIssue}
            progress={sprintProgress.get(sprint.id)}
            accentColor={SPRINT_STATUS_COLOR[sprint.status]}
            right={
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${SPRINT_STATUS_COLOR[sprint.status]}1a`,
                    color: SPRINT_STATUS_COLOR[sprint.status],
                  }}
                >
                  {SPRINT_STATUS_LABEL[sprint.status]}
                </span>
                <label className="flex items-center gap-1 text-xs text-ink/50">
                  Del
                  <input
                    type="date"
                    value={toDateInputValue(sprint.startDate)}
                    onChange={(e) => updateSprintDate(sprint.id, "startDate", e.target.value)} data-testid={`backlog-sprint-start-date-${sprint.id}`}
                    className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-ink/50">
                  al
                  <input
                    type="date"
                    value={toDateInputValue(sprint.endDate)}
                    onChange={(e) => updateSprintDate(sprint.id, "endDate", e.target.value)} data-testid={`backlog-sprint-end-date-${sprint.id}`}
                    className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
                  />
                </label>
                {sprint.status === "PLANNED" && (
                  <Button variant="ghost" onClick={() => runSprintAction(sprint.id, "start")} data-testid={`backlog-sprint-start-${sprint.id}`}>
                    Iniciar
                  </Button>
                )}
                {sprint.status === "ACTIVE" && (
                  <Button variant="ghost" onClick={() => runSprintAction(sprint.id, "complete")} data-testid={`backlog-sprint-complete-${sprint.id}`}>
                    Completar
                  </Button>
                )}
              </div>
            }
          />
        ))}
        <Section
          id="backlog"
          title="Backlog"
          issues={groups.get("backlog") ?? []}
          allIssueIds={groupIds.get("backlog") ?? []}
          targets={moveTargets}
          onMoveTo={(issueId, containerId) => placeIssue(issueId, containerId, "end")}
          onStep={stepIssue}
        />
        <DragOverlay>
          {activeIssue ? (
            <BacklogRow
              issue={activeIssue}
              targets={moveTargets}
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
