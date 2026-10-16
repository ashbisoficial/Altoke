import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { KanbanBoard } from "@/components/board/KanbanBoard";
import { CreateIssueForm } from "@/components/board/CreateIssueForm";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { projectId } = await searchParams;
  if (!projectId) notFound();

  if (!(await isProjectMember(user.id, projectId))) notFound();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) notFound();
  const project = projectSnap.data()!;

  const issueTypesSnap = await adminDb.collection(`projects/${projectId}/issueTypes`).get();
  const issueTypes = issueTypesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as { id: string; name: string; isSubtask?: boolean })
    .filter((t) => !t.isSubtask);

  const issuesSnap = await adminDb
    .collection("issues")
    .where("projectId", "==", projectId)
    .where("parentId", "==", null)
    .get();
  issuesSnap.docs.sort((a, b) => (b.data().createdAt?.toMillis() ?? 0) - (a.data().createdAt?.toMillis() ?? 0));

  const statuses = [...(project.workflow?.statuses ?? [])].sort(
    (a: { order: number }, b: { order: number }) => a.order - b.order,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
            >
              <ArrowLeft size={13} />
              Panel
            </Link>
            <h1 className="font-heading text-2xl font-semibold">{project.name}</h1>
          </div>
          <CreateIssueForm
            projectId={projectId}
            issueTypes={issueTypes.map((t) => ({ id: t.id, name: t.name }))}
          />
        </div>
        <ProjectNav projectId={projectId} active="board" />
      </header>

      <KanbanBoard
        statuses={statuses.map((s: { id: string; name: string; color: string; order: number }) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          order: s.order,
        }))}
        initialIssues={issuesSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            key: data.key,
            title: data.title,
            priority: data.priority,
            statusId: data.statusId,
            issueType: data.issueType,
            assignee: data.assignee,
            subtaskCount: data.childCount ?? 0,
          };
        })}
      />
    </main>
  );
}
