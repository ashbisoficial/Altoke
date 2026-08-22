import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { CreateOrgForm } from "@/components/dashboard/CreateOrgForm";
import { CreateProjectForm } from "@/components/dashboard/CreateProjectForm";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

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
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Altoke</h1>
          <p className="text-sm text-ink/60">
            {user.name ?? user.email} · {organizations.length} organización
            {organizations.length === 1 ? "" : "es"}
          </p>
        </div>
        <LogoutButton />
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
            <h2 className="font-heading text-lg font-semibold">{org.name}</h2>
            {org.projects.length === 0 ? (
              <p className="mt-2 text-sm text-ink/60">Sin proyectos todavía.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {org.projects.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/board?projectId=${project.id}`}
                      className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-accent">{project.key}</span>
                        <span className="text-xs text-ink/50">{project._count.issues} incidencias</span>
                      </div>
                      <p className="mt-1 font-heading text-base font-medium">{project.name}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
