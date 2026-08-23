"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export type BoardIssue = {
  id: string;
  key: string;
  title: string;
  priority: "HIGHEST" | "HIGH" | "MEDIUM" | "LOW" | "LOWEST";
  statusId: string;
  issueType: { name: string; color: string | null };
  assignee: { name: string | null; email: string; avatarUrl: string | null } | null;
  subtaskCount?: number;
};

const PRIORITY_LABEL: Record<BoardIssue["priority"], string> = {
  HIGHEST: "Urgente",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  LOWEST: "Muy baja",
};

export function IssueCard({ issue }: { issue: BoardIssue }) {
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
      className="ticket-stub cursor-grab touch-none rounded-lg border border-border bg-surface p-3 pt-2 shadow-sm active:cursor-grabbing"
    >
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-xs font-medium text-accent">{issue.key}</span>
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }}
          title={issue.issueType.name}
        />
      </div>
      <Link
        href={`/issues/${issue.id}`}
        onPointerDown={(e) => e.stopPropagation()}
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
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[10px] font-medium text-accent"
            title={issue.assignee.name ?? issue.assignee.email}
          >
            {(issue.assignee.name ?? issue.assignee.email).slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
