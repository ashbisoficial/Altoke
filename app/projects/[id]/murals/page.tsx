import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { CreateMuralForm } from "@/components/mural/CreateMuralForm";

export default async function ProjectMuralsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const murals = await prisma.board.findMany({
    where: { projectId, type: "MURAL" },
    include: { _count: { select: { muralElements: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/board?projectId=${project.id}`} className="text-xs text-accent underline underline-offset-4">
            ← Tablero
          </Link>
          <h1 className="font-heading text-2xl font-semibold">Murales — {project.name}</h1>
        </div>
        <CreateMuralForm projectId={project.id} />
      </header>

      {murals.length === 0 ? (
        <p className="text-sm text-ink/60">Todavía no hay murales. Crea el primero para empezar.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {murals.map((mural) => (
            <li key={mural.id}>
              <Link
                href={`/mural/${mural.id}`}
                className="block rounded-lg border border-border bg-surface p-4 hover:border-accent"
              >
                <p className="font-heading text-base font-medium">{mural.name}</p>
                <p className="mt-1 text-xs text-ink/50">{mural._count.muralElements} elementos</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
