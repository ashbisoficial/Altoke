import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { BacklogBoard } from "@/components/backlog/BacklogBoard";

export default async function BacklogPage({
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
    include: { sprints: { orderBy: { createdAt: "asc" } } },
  });
  if (!project) notFound();

  const issues = await prisma.issue.findMany({
    where: { projectId, parentId: null },
    include: {
      issueType: { select: { name: true, color: true } },
      status: { select: { name: true, color: true } },
      assignee: { select: { name: true, email: true } },
    },
    orderBy: { number: "asc" },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-4">
        <Link href={`/board?projectId=${project.id}`} className="text-xs text-accent underline underline-offset-4">
          ← Tablero
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Backlog — {project.name}</h1>
      </header>

      <BacklogBoard
        projectId={project.id}
        sprints={project.sprints.map((s) => ({ id: s.id, name: s.name, status: s.status }))}
        initialIssues={issues.map((issue) => ({
          id: issue.id,
          key: issue.key,
          title: issue.title,
          sprintId: issue.sprintId,
          storyPoints: issue.storyPoints,
          issueType: issue.issueType,
          status: issue.status,
          assignee: issue.assignee,
        }))}
      />
    </main>
  );
}
