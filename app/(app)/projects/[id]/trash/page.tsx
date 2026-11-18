import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { loadProjectTrash } from "@/lib/trash-queries";
import { TrashList } from "@/components/trash/TrashList";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function TrashPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  if (!(await isProjectMember(user.id, id))) notFound();

  const project = await prisma.project.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!project) notFound();

  const trash = await loadProjectTrash(id, user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Papelera — {project.name}</h1>
        <ProjectNav projectId={project.id} active="trash" />
      </header>
      <p className="mb-4 text-sm text-ink/60">
        Lo borrado aquí no aparece en listados ni búsquedas. Restaurar devuelve la incidencia con sus comentarios y enlaces.
      </p>
      <TrashList trash={trash} />
    </main>
  );
}
