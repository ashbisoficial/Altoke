import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { WorkflowEditor } from "@/components/workflow/WorkflowEditor";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function WorkflowPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) notFound();
  const project = projectSnap.data()!;

  const canEdit = await hasProjectPermission(user.id, projectId, "workflow.edit");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">Flujo de trabajo — {project.name}</h1>
          {!canEdit && (
            <p className="mt-1 text-sm text-ink/60">
              Solo puedes ver el flujo. Pide a un administrador que te dé permiso para editarlo.
            </p>
          )}
        </div>
        <ProjectNav projectId={projectId} active="workflow" />
      </header>

      <WorkflowEditor
        workflowId={projectId}
        statuses={(project.workflow?.statuses ?? []).map((s: Record<string, unknown>) => ({
          ...s,
          isInitial: Boolean(s.isInitial),
        }))}
        transitions={project.workflow?.transitions ?? []}
        canEdit={canEdit}
      />
    </main>
  );
}
