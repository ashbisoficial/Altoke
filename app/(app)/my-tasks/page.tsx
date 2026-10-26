import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, ListTodo } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { PRIORITY_LABEL, PRIORITY_ORDER, type Priority } from "@/lib/priority";

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default async function MyTasksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const snap = await adminDb.collection("issues").where("assigneeId", "==", user.id).get();
  const issues = snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      key: data.key as string,
      title: data.title as string,
      priority: data.priority as Priority,
      dueDate: tsToISO(data.dueDate),
      projectId: data.projectId as string,
      status: data.status as { name: string; color: string; category: string },
      issueType: data.issueType as { name: string; color: string | null },
    };
  });
  issues.sort((a, b) => {
    const dueDiff = (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    if (dueDiff !== 0) return dueDiff;
    return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
  });

  const projectIds = [...new Set(issues.map((i) => i.projectId))];
  const projectSnaps = projectIds.length
    ? await adminDb.getAll(...projectIds.map((id) => adminDb.doc(`projects/${id}`)))
    : [];
  const projectById = new Map(projectSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const pending = issues.filter((issue) => issue.status.category !== "DONE");
  const todayKey = new Date().toISOString().slice(0, 10);

  const byProject = new Map<string, { project: { id: string; key: string; name: string }; issues: typeof issues }>();
  for (const issue of pending) {
    const entry = byProject.get(issue.projectId);
    if (entry) entry.issues.push(issue);
    else {
      const p = projectById.get(issue.projectId);
      byProject.set(issue.projectId, {
        project: { id: issue.projectId, key: p?.key ?? "", name: p?.name ?? "" },
        issues: [issue],
      });
    }
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
                  const overdue = !!issue.dueDate && issue.dueDate.slice(0, 10) < todayKey;
                  return (
                    <li key={issue.id}>
                      <Link
                        href={`/issues/${issue.id}`}
                        className="flex flex-wrap items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
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
