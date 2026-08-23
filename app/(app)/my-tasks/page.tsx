import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ListTodo } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { PRIORITY_LABEL } from "@/lib/priority";

function formatDueDate(date: Date) {
  return date.toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function MyTasksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const issues = await prisma.issue.findMany({
    where: { assigneeId: user.id },
    include: {
      project: { select: { id: true, key: true, name: true } },
      status: { select: { name: true, color: true, category: true } },
      issueType: { select: { name: true, color: true } },
    },
    orderBy: [{ dueDate: "asc" }, { priority: "asc" }],
  });

  const pending = issues.filter((issue) => issue.status.category !== "DONE");
  const todayKey = new Date().toISOString().slice(0, 10);

  const byProject = new Map<string, { project: (typeof issues)[number]["project"]; issues: typeof issues }>();
  for (const issue of pending) {
    const entry = byProject.get(issue.project.id);
    if (entry) entry.issues.push(issue);
    else byProject.set(issue.project.id, { project: issue.project, issues: [issue] });
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold">
          <ListTodo size={22} className="text-accent" />
          Mis tareas
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          {pending.length > 0
            ? `${pending.length} tarea${pending.length === 1 ? "" : "s"} pendiente${pending.length === 1 ? "" : "s"}, en todos tus proyectos.`
            : "Todo lo que tenés asignado, en un solo lugar."}
        </p>
      </header>

      {pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-ink/60">
          {issues.length === 0
            ? "Todavía no tenés incidencias asignadas. Cuando alguien te asigne una, o te asignes una vos mismo, va a aparecer acá."
            : "¡Estás al día! No te queda ninguna tarea pendiente."}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(byProject.values()).map(({ project, issues: projectIssues }) => (
            <section key={project.id}>
              <div className="mb-2 flex items-center gap-2">
                <Link
                  href={`/board?projectId=${project.id}`}
                  className="font-mono text-xs text-accent hover:underline underline-offset-4"
                >
                  {project.key}
                </Link>
                <h2 className="text-sm font-medium text-ink/70">{project.name}</h2>
              </div>
              <ul className="flex flex-col gap-1.5">
                {projectIssues.map((issue) => {
                  const overdue = !!issue.dueDate && issue.dueDate.toISOString().slice(0, 10) < todayKey;
                  return (
                    <li key={issue.id}>
                      <Link
                        href={`/issues/${issue.id}`}
                        className="flex flex-wrap items-center gap-2.5 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: issue.issueType.color ?? "#94A3B8" }}
                          title={issue.issueType.name}
                        />
                        <span className="font-mono text-xs text-accent">{issue.key}</span>
                        <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                          style={{ backgroundColor: `${issue.status.color}20`, color: issue.status.color }}
                        >
                          {issue.status.name}
                        </span>
                        <span className="shrink-0 text-xs text-ink/50">{PRIORITY_LABEL[issue.priority]}</span>
                        {issue.dueDate && (
                          <span
                            className={`flex shrink-0 items-center gap-1 text-xs ${
                              overdue ? "font-medium text-red-600" : "text-ink/50"
                            }`}
                          >
                            <CalendarDays size={12} />
                            {formatDueDate(issue.dueDate)}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
