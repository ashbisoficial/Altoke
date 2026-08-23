import Link from "next/link";
import { CalendarDays, FlaskConical, GitBranch, LayoutGrid, ListTodo, StickyNote, Users } from "lucide-react";

export type ProjectSection = "board" | "backlog" | "calendar" | "workflow" | "tests" | "murals" | "members";

const SECTIONS: { key: ProjectSection; label: string; icon: React.ReactNode; href: (id: string) => string }[] = [
  { key: "board", label: "Tablero", icon: <LayoutGrid size={14} />, href: (id) => `/board?projectId=${id}` },
  { key: "backlog", label: "Backlog", icon: <ListTodo size={14} />, href: (id) => `/backlog?projectId=${id}` },
  { key: "calendar", label: "Calendario", icon: <CalendarDays size={14} />, href: (id) => `/projects/${id}/calendar` },
  { key: "workflow", label: "Flujo", icon: <GitBranch size={14} />, href: (id) => `/projects/${id}/workflow` },
  { key: "tests", label: "Pruebas", icon: <FlaskConical size={14} />, href: (id) => `/projects/${id}/tests` },
  { key: "murals", label: "Murales", icon: <StickyNote size={14} />, href: (id) => `/projects/${id}/murals` },
  { key: "members", label: "Miembros", icon: <Users size={14} />, href: (id) => `/projects/${id}/members` },
];

export function ProjectNav({ projectId, active }: { projectId: string; active: ProjectSection }) {
  return (
    <nav className="flex flex-wrap items-center gap-0.5 rounded-lg bg-bg p-0.5 text-xs">
      {SECTIONS.map((section) => (
        <Link
          key={section.key}
          href={section.href(projectId)}
          aria-current={section.key === active ? "page" : undefined}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
            section.key === active
              ? "bg-surface text-ink shadow-sm"
              : "text-ink/60 hover:bg-surface/60 hover:text-ink"
          }`}
        >
          {section.icon}
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
