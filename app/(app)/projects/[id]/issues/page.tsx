import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { ProjectNav } from "@/components/project/ProjectNav";
import { SavedFilters } from "@/components/issues/SavedFilters";
import { IssueListFilters } from "@/components/issues/IssueListFilters";
import { IssueTable } from "@/components/issues/IssueTable";
import {
  PAGE_SIZE,
  buildIssueOrder,
  buildIssueWhere,
  filterQueryString,
  parseListQuery,
  type FieldDefLite,
} from "@/lib/issue-query";

type SearchParams = Record<string, string | string[] | undefined>;

function toUrlSearchParams(input: SearchParams) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) value.forEach((v) => sp.append(key, v));
    else if (value !== undefined) sp.append(key, value);
  }
  return sp;
}

/**
 * Vista de lista (F1-3). Toda la vista sale de la URL: el filtro, el orden,
 * las columnas y la página. Quien abre el enlace ve lo mismo, respetando
 * que solo ve el proyecto si es miembro.
 */
export default async function IssueListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      issueTypes: { where: { isSubtask: false }, orderBy: { name: "asc" } },
      workflow: { include: { statuses: { orderBy: { order: "asc" } } } },
      sprints: { orderBy: { createdAt: "asc" } },
      labels: { orderBy: { name: "asc" } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      customFields: { orderBy: { position: "asc" } },
    },
  });
  if (!project) notFound();

  const sp = toUrlSearchParams(await searchParams);
  const defs: FieldDefLite[] = project.customFields.map((f) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    options: (f.options as string[] | null) ?? null,
  }));
  const query = parseListQuery(sp, defs);
  const where = buildIssueWhere(projectId, query, defs);

  const [total, issues, savedFilters] = await Promise.all([
    prisma.issue.count({ where }),
    prisma.issue.findMany({
      where,
      include: {
        issueType: { select: { name: true, color: true } },
        status: { select: { id: true, name: true, color: true, category: true } },
        assignee: { select: { name: true, email: true } },
        sprint: { select: { name: true } },
      },
      orderBy: buildIssueOrder(query.sort),
      skip: (query.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.savedFilter.findMany({
      where: { projectId, OR: [{ shared: true }, { ownerId: user.id }] },
      select: { id: true, name: true, query: true, shared: true, ownerId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const currentQuery = filterQueryString(sp);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (page: number) => {
    const next = new URLSearchParams(currentQuery);
    if (page > 1) next.set("page", String(page));
    const qs = next.toString();
    return `/projects/${projectId}/issues${qs ? `?${qs}` : ""}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Lista — {project.name}</h1>
        <ProjectNav projectId={project.id} active="list" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-4">
          <IssueListFilters
            projectId={projectId}
            query={query}
            rawParams={sp}
            statuses={project.workflow.statuses.map((s) => ({ id: s.id, name: s.name }))}
            types={project.issueTypes.map((t) => ({ id: t.id, name: t.name }))}
            sprints={project.sprints.map((s) => ({ id: s.id, name: s.name }))}
            labels={project.labels.map((l) => ({ id: l.id, name: l.name }))}
            people={project.members.map((m) => ({ id: m.user.id, name: m.user.name ?? m.user.email }))}
            customFields={project.customFields.map((f) => ({
              id: f.id,
              name: f.name,
              type: f.type,
              options: (f.options as string[] | null) ?? null,
            }))}
          />

          <p className="text-xs text-ink/50" data-testid="issue-list-count">
            {total} {total === 1 ? "incidencia" : "incidencias"}
          </p>

          <IssueTable
            projectId={projectId}
            issues={issues.map((i) => ({
              id: i.id,
              key: i.key,
              title: i.title,
              priority: i.priority,
              storyPoints: i.storyPoints,
              dueDate: i.dueDate?.toISOString() ?? null,
              updatedAt: i.updatedAt.toISOString(),
              issueType: i.issueType,
              status: { id: i.status.id ?? "", name: i.status.name, color: i.status.color, category: i.status.category },
              assignee: i.assignee,
              sprintName: i.sprint?.name ?? null,
            }))}
            columns={query.columns}
            sort={query.sort}
            sortLinks={Object.fromEntries(
              ["key", "title", "status", "priority", "dueDate", "updatedAt"].map((field) => {
                const next = new URLSearchParams(currentQuery);
                next.delete("page");
                const isCurrent = query.sort?.field === field;
                const dir = isCurrent && query.sort?.dir === "asc" ? "-" : "";
                next.set("sort", `${dir}${field}`);
                return [field, `/projects/${projectId}/issues?${next.toString()}`];
              }),
            )}
            options={{
              statuses: project.workflow.statuses.map((s) => ({ id: s.id, name: s.name })),
              sprints: project.sprints.map((s) => ({ id: s.id, name: s.name })),
              labels: project.labels.map((l) => ({ id: l.id, name: l.name })),
              people: project.members.map((m) => ({ id: m.user.id, name: m.user.name ?? m.user.email })),
            }}
          />

          {pageCount > 1 && (
            <nav className="flex items-center gap-3 text-sm" aria-label="Paginación">
              {query.page > 1 && (
                <Link href={pageHref(query.page - 1)} className="text-accent hover:underline" data-testid="issue-list-prev">
                  Anterior
                </Link>
              )}
              <span className="text-ink/50">
                Página {query.page} de {pageCount}
              </span>
              {query.page < pageCount && (
                <Link href={pageHref(query.page + 1)} className="text-accent hover:underline" data-testid="issue-list-next">
                  Siguiente
                </Link>
              )}
            </nav>
          )}
        </div>

        <SavedFilters
          projectId={projectId}
          currentQuery={currentQuery}
          currentUserId={user.id}
          filters={savedFilters.map((f) => ({ ...f, href: `/projects/${projectId}/issues?${f.query}` }))}
        />
      </div>
    </main>
  );
}
