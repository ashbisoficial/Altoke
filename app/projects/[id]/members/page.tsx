import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ProjectMembersManager } from "@/components/members/ProjectMembersManager";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function ProjectMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } }, role: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!project) notFound();

  const roles = await prisma.role.findMany({
    where: { organizationId: project.organizationId },
    orderBy: { name: "asc" },
  });

  const canManage = await hasProjectPermission(user.id, projectId, "member.manage");

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Miembros — {project.name}</h1>
        <ProjectNav projectId={project.id} active="members" />
      </header>

      <ProjectMembersManager
        projectId={project.id}
        members={project.members}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        canManage={canManage}
        currentUserId={user.id}
      />
    </main>
  );
}
