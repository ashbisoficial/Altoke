"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

type CalendarIssue = {
  id: string;
  key: string;
  title: string;
  dueDate: string;
  issueType: { name: string; color: string | null };
};

type CalendarSprint = {
  id: string;
  name: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  startDate: string | null;
  endDate: string | null;
};

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const SPRINT_STATUS_LABEL: Record<CalendarSprint["status"], string> = {
  PLANNED: "Planeado",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
};

const SPRINT_STATUS_COLOR: Record<CalendarSprint["status"], string> = {
  PLANNED: "#94A3B8",
  ACTIVE: "#2952CC",
  COMPLETED: "#16A34A",
};

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Fechas de solo-día (dueDate, sprints) se guardan como medianoche UTC (ver
// updateSprintDate en BacklogBoard). Tomamos el prefijo "YYYY-MM-DD" tal
// cual en vez de usar getters locales, para no desplazar el día según la
// zona horaria de quien mira el calendario.
function dateKeyFromISO(iso: string) {
  return iso.slice(0, 10);
}

function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function ProjectCalendar({
  issues,
  sprints,
}: {
  issues: CalendarIssue[];
  sprints: CalendarSprint[];
}) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const weeks = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Monday-first weekday index (0 = Monday .. 6 = Sunday)
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - firstWeekday);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const result: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) result.push(days.slice(i, i + 7));
    return result;
  }, [cursor]);

  const issuesByDay = useMemo(() => {
    const map = new Map<string, CalendarIssue[]>();
    for (const issue of issues) {
      const key = dateKeyFromISO(issue.dueDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(issue);
    }
    return map;
  }, [issues]);

  function issuesFor(day: Date) {
    return issuesByDay.get(dateKey(day)) ?? [];
  }

  const selectedIssues = selectedDay ? issuesFor(selectedDay) : [];

  return (
    <div className="flex flex-col gap-6">
      {sprints.length > 0 && (
        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Sprints</h2>
          <ul className="flex flex-col gap-1.5">
            {sprints.map((sprint) => (
              <li
                key={sprint.id}
                className="shadow-soft-hover flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: SPRINT_STATUS_COLOR[sprint.status] }}
                />
                <span className="font-medium">{sprint.name}</span>
                <span className="text-xs text-ink/50">{SPRINT_STATUS_LABEL[sprint.status]}</span>
                <span className="ml-auto text-xs text-ink/60">
                  {sprint.startDate && sprint.endDate
                    ? `${formatDateShort(sprint.startDate)} – ${formatDateShort(sprint.endDate)}`
                    : "Sin fechas todavía"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-heading text-lg font-semibold">
            {MONTH_LABELS[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 hover:bg-bg"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              className="rounded-lg px-2 py-1 text-xs font-medium text-ink/70 hover:bg-bg"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink/70 hover:bg-bg"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="shadow-soft grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border text-xs">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="bg-bg px-2 py-1.5 text-center font-medium text-ink/60">
              {label}
            </div>
          ))}
          {weeks.map((week) =>
            week.map((day) => {
              const inMonth = day.getMonth() === cursor.getMonth();
              const dayIssues = issuesFor(day);
              const isToday = sameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={`flex min-h-20 flex-col items-start gap-1 bg-surface p-1.5 text-left align-top ${
                    inMonth ? "" : "opacity-40"
                  } hover:bg-bg`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
                      isToday ? "bg-accent font-semibold text-accentInk" : "text-ink/70"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex w-full flex-col gap-0.5">
                    {dayIssues.slice(0, 2).map((issue) => (
                      <span
                        key={issue.id}
                        className="flex items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[10px]"
                        style={{ backgroundColor: `${issue.issueType.color ?? "#94A3B8"}20` }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }}
                        />
                        <span className="truncate">{issue.key}</span>
                      </span>
                    ))}
                    {dayIssues.length > 2 && (
                      <span className="text-[10px] text-ink/50">+{dayIssues.length - 2} más</span>
                    )}
                  </div>
                </button>
              );
            }),
          )}
        </div>
      </section>

      {selectedDay && (
        <section className="shadow-soft rounded-xl border border-border bg-surface p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Flag size={14} className="text-accent" />
              {selectedDay.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
            </h3>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-xs text-ink/40 hover:text-ink"
            >
              Cerrar
            </button>
          </div>
          {selectedIssues.length === 0 ? (
            <p className="text-sm text-ink/50">Sin incidencias con esta fecha de entrega.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {selectedIssues.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={`/issues/${issue.id}`}
                    className="shadow-soft-hover flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }}
                    />
                    <span className="font-mono text-xs text-accent">{issue.key}</span>
                    <span className="truncate">{issue.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
