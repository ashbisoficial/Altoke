"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type BacklogIssue = {
  id: string;
  key: string;
  title: string;
  sprintId: string | null;
  storyPoints: number | null;
  issueType: { name: string; color: string | null };
  status: { name: string; color: string; category?: string };
  assignee: { name: string | null; email: string } | null;
};

export type MoveTarget = { id: string; name: string };

/**
 * Fila del backlog. Se puede arrastrar, y además tiene una alternativa por
 * teclado (F0-3): un selector "Mover a…" y botones para subir y bajar.
 */
export function BacklogRow({
  issue,
  targets,
  canMoveUp,
  canMoveDown,
  onMoveTo,
  onStep,
}: {
  issue: BacklogIssue;
  targets: MoveTarget[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveTo: (containerId: string) => void;
  onStep: (delta: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Los controles no deben iniciar el arrastre (ni el sensor de teclado de
  // dnd-kit, que escucha espacio y Enter).
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={0}
      data-testid={`backlog-row-${issue.key}`}
      className="shadow-soft-hover flex cursor-grab touch-none items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm active:cursor-grabbing"
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }}
        title={issue.issueType.name}
      />
      <span className="shrink-0 font-mono text-xs text-accent">{issue.key}</span>
      <Link
        href={`/issues/${issue.id}`}
        onPointerDown={stop}
        onKeyDown={stop}
        data-testid={`backlog-row-link-${issue.key}`}
        className="flex-1 truncate hover:underline"
      >
        {issue.title}
      </Link>
      {issue.storyPoints !== null && (
        <span className="shrink-0 rounded bg-bg px-1.5 py-0.5 text-xs text-ink/60">
          {issue.storyPoints} pts
        </span>
      )}
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-xs text-white"
        style={{ backgroundColor: issue.status.color }}
      >
        {issue.status.name}
      </span>
      {issue.assignee && (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent3/10 text-[10px] font-medium text-accent3"
          title={issue.assignee.name ?? issue.assignee.email}
        >
          {(issue.assignee.name ?? issue.assignee.email).slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="flex shrink-0 items-center gap-1" onPointerDown={stop} onKeyDown={stop}>
        <button
          type="button"
          aria-label={`Subir ${issue.key}`}
          disabled={!canMoveUp}
          onClick={() => onStep(-1)}
          data-testid={`backlog-row-up-${issue.key}`}
          className="rounded px-1.5 text-xs text-ink/60 hover:bg-bg disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Bajar ${issue.key}`}
          disabled={!canMoveDown}
          onClick={() => onStep(1)}
          data-testid={`backlog-row-down-${issue.key}`}
          className="rounded px-1.5 text-xs text-ink/60 hover:bg-bg disabled:opacity-30"
        >
          ↓
        </button>
        <select
          aria-label={`Mover ${issue.key} a…`}
          value=""
          onChange={(e) => e.target.value && onMoveTo(e.target.value)}
          data-testid={`backlog-row-move-${issue.key}`}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
        >
          <option value="">Mover a…</option>
          {targets.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
