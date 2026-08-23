import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      issueTypes: { where: { isSubtask: false } },
      workflow: { include: { statuses: { orderBy: { order: "asc" } } } },
    },
  });
  if (!project) notFound();

  const issues = await prisma.issue.findMany({
    where: { projectId, parentId: null },
    include: {
      issueType: { select: { name: true, color: true } },
      assignee: { select: { name: true, email: true, avatarUrl: true } },
      _count: { select: { children: true } },
    },
    orderBy: { createdAt: "desc" },
  });

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
            projectId={project.id}
            issueTypes={project.issueTypes.map((t) => ({ id: t.id, name: t.name }))}
          />
        </div>
        <ProjectNav projectId={project.id} active="board" />
      </header>

      <KanbanBoard
        statuses={project.workflow.statuses.map((s) => ({
          id: s.id,
          name: s.name,
          color: s.color,
          order: s.order,
        }))}
        initialIssues={issues.map((issue) => ({
          id: issue.id,
          key: issue.key,
          title: issue.title,
          priority: issue.priority,
          statusId: issue.statusId,
          issueType: issue.issueType,
          assignee: issue.assignee,
          subtaskCount: issue._count.children,
        }))}
      />
    </main>
  );
}
