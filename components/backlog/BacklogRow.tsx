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

export function BacklogRow({ issue }: { issue: BacklogIssue }) {
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
        onPointerDown={(e) => e.stopPropagation()}
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
    </div>
  );
}
