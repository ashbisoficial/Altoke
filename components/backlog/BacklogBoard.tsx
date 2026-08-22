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
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BacklogRow, type BacklogIssue } from "./BacklogRow";

export type BacklogSprint = { id: string; name: string; status: "PLANNED" | "ACTIVE" | "COMPLETED" };

const SPRINT_STATUS_LABEL: Record<BacklogSprint["status"], string> = {
  PLANNED: "Planeado",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
};

function Section({
  id,
  title,
  right,
  issues,
}: {
  id: string;
  title: string;
  right?: React.ReactNode;
  issues: BacklogIssue[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-heading text-sm font-semibold">{title}</h2>
        <span className="text-xs text-ink/50">{issues.length}</span>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groups = useMemo(() => {
    const map = new Map<string, BacklogIssue[]>();
    map.set("backlog", []);
    for (const sprint of sprints) map.set(sprint.id, []);
    for (const issue of issues) {
      const key = issue.sprintId ?? "backlog";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
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
            right={
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink/50">{SPRINT_STATUS_LABEL[sprint.status]}</span>
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
