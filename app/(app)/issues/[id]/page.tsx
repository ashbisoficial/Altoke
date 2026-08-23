import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { IssueDetail } from "@/components/issue/IssueDetail";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      issueType: true,
      status: true,
      assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      reporter: { select: { id: true, name: true, email: true, avatarUrl: true } },
      labels: { include: { label: true } },
      comments: {
        include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: { orderBy: { createdAt: "desc" } },
      children: { include: { issueType: true, status: true }, orderBy: { number: "asc" } },
      parent: { select: { id: true, key: true, title: true } },
      linksFrom: {
        include: { target: { select: { id: true, key: true, title: true } } },
        orderBy: { createdAt: "asc" },
      },
      linksTo: {
        include: { source: { select: { id: true, key: true, title: true } } },
        orderBy: { createdAt: "asc" },
      },
      activity: {
        include: { actor: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });
  if (!issue) notFound();
  if (!(await isProjectMember(user.id, issue.projectId))) notFound();

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: issue.projectId },
    include: {
      issueTypes: true,
      sprints: { orderBy: { createdAt: "desc" } },
      members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      workflow: { include: { statuses: { orderBy: { order: "asc" } }, transitions: true } },
      labels: { orderBy: { name: "asc" } },
    },
  });

  const otherIssues = await prisma.issue.findMany({
    where: { projectId: issue.projectId, id: { not: issue.id } },
    select: { id: true, key: true, title: true },
    orderBy: { number: "asc" },
  });

  return (
    <IssueDetail
      issue={issue}
      project={project}
      currentUserId={user.id}
      otherIssues={otherIssues}
    />
  );
}
