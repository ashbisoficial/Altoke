"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PRIORITY_LABEL, type Priority } from "@/lib/priority";

export type BoardIssue = {
  id: string;
  key: string;
  title: string;
  priority: Priority;
  statusId: string;
  issueType: { name: string; color: string | null };
  assignee: { name: string | null; email: string; avatarUrl: string | null } | null;
  subtaskCount?: number;
};

export type StatusTarget = { id: string; name: string };

/**
 * Tarjeta del tablero. Se puede arrastrar y, como alternativa por teclado
 * (F0-3), tiene un selector "Mover a…" de estado y botones para subir y bajar.
 */
export function IssueCard({
  issue,
  targets,
  canMoveUp,
  canMoveDown,
  onMoveTo,
  onStep,
}: {
  issue: BoardIssue;
  targets: StatusTarget[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveTo: (statusId: string) => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      tabIndex={0}
      data-testid={`board-card-${issue.key}`}
      className="ticket-stub shadow-soft-hover cursor-grab touch-none rounded-xl border border-border bg-surface p-3 pt-2 active:cursor-grabbing"
    >
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-xs font-medium text-accent">{issue.key}</span>
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }}
          title={issue.issueType.name}
        />
      </div>
      <Link
        href={`/issues/${issue.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        data-testid={`board-card-link-${issue.key}`}
        className="block pt-3 text-sm font-medium leading-snug hover:underline"
      >
        {issue.title}
      </Link>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-1 text-xs text-ink/60">
        <span className="flex items-center gap-2 truncate">
          {PRIORITY_LABEL[issue.priority]}
          {!!issue.subtaskCount && (
            <span className="flex items-center gap-0.5 text-ink/50" title="Subtareas">
              <ListChecks size={12} />
              {issue.subtaskCount}
            </span>
          )}
        </span>
        {issue.assignee && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent3/10 text-[10px] font-medium text-accent3"
            title={issue.assignee.name ?? issue.assignee.email}
          >
            {(issue.assignee.name ?? issue.assignee.email).slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <div
        className="mt-2 flex items-center gap-1"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label={`Subir ${issue.key}`}
          disabled={!canMoveUp}
          onClick={() => onStep(-1)}
          data-testid={`board-card-up-${issue.key}`}
          className="rounded px-1.5 text-xs text-ink/60 hover:bg-bg disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Bajar ${issue.key}`}
          disabled={!canMoveDown}
          onClick={() => onStep(1)}
          data-testid={`board-card-down-${issue.key}`}
          className="rounded px-1.5 text-xs text-ink/60 hover:bg-bg disabled:opacity-30"
        >
          ↓
        </button>
        <select
          aria-label={`Mover ${issue.key} a…`}
          value=""
          onChange={(e) => e.target.value && onMoveTo(e.target.value)}
          data-testid={`board-card-move-${issue.key}`}
          className="ml-auto max-w-[60%] rounded border border-border bg-surface px-1 py-0.5 text-xs"
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
