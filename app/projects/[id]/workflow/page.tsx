import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workflow: { include: { statuses: true, transitions: true } } },
  });
  if (!project) notFound();

  const canEdit = await hasProjectPermission(user.id, projectId, "workflow.edit");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-4">
        <Link href={`/board?projectId=${project.id}`} className="text-xs text-accent underline underline-offset-4">
          ← Tablero
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Flujo de trabajo — {project.name}</h1>
        {!canEdit && (
          <p className="mt-1 text-sm text-ink/60">
            Solo puedes ver el flujo. Pide a un administrador que te dé permiso para editarlo.
          </p>
        )}
      </header>

      <WorkflowEditor
        workflowId={project.workflow.id}
        statuses={project.workflow.statuses}
        transitions={project.workflow.transitions}
        canEdit={canEdit}
      />
    </main>
  );
}
