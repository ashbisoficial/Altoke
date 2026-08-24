import Link from "next/link";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { CreateOrgForm } from "@/components/dashboard/CreateOrgForm";
import { CreateProjectForm } from "@/components/dashboard/CreateProjectForm";

const PROJECT_ACCENTS = [
  { bar: "bg-accent", chip: "bg-accent/10 text-accent" },
  { bar: "bg-accent2", chip: "bg-accent2/10 text-accent2" },
  { bar: "bg-accent3", chip: "bg-accent3/10 text-accent3" },
  { bar: "bg-status-done", chip: "bg-status-done/10 text-status-done" },
  { bar: "bg-status-review", chip: "bg-status-review/10 text-status-review" },
];

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { issues: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-semibold">Hola, {user.name ?? user.email}</h1>
        <p className="text-sm text-ink/60">
          {organizations.length} organización
          {organizations.length === 1 ? "" : "es"}
        </p>
      </header>

      <section className="mb-10 flex flex-wrap gap-3">
        <CreateOrgForm />
        <CreateProjectForm organizations={organizations.map((o) => ({ id: o.id, name: o.name }))} />
      </section>

      {organizations.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-ink/60">
          Todavía no perteneces a ninguna organización. Crea la primera para empezar.
        </p>
      )}

      <div className="flex flex-col gap-8">
        {organizations.map((org) => (
          <section key={org.id}>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-semibold">{org.name}</h2>
              <Link
                href={`/organizations/${org.id}/members`}
                className="flex items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
              >
                <Users size={13} />
                Miembros
              </Link>
            </div>
            {org.projects.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">Sin proyectos todavía.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {org.projects.map((project, i) => {
                  const accent = PROJECT_ACCENTS[i % PROJECT_ACCENTS.length];
                  return (
                    <li key={project.id}>
                      <Link
                        href={`/board?projectId=${project.id}`}
                        className="shadow-soft-hover block overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent"
                      >
                        <div className={`h-1.5 ${accent.bar}`} />
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <span className={`rounded-full px-2 py-0.5 font-mono text-xs ${accent.chip}`}>
                              {project.key}
                            </span>
                            <span className="text-xs text-ink/50">{project._count.issues} incidencias</span>
                          </div>
                          <p className="mt-2 font-heading text-base font-medium">{project.name}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
