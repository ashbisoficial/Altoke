import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";
import { ProjectMembersManager } from "@/components/members/ProjectMembersManager";
import { ProjectNav } from "@/components/project/ProjectNav";

export default async function ProjectMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) notFound();
  const project = projectSnap.data()!;

  const [membersSnap, canManage] = await Promise.all([
    adminDb.collection(`projects/${projectId}/members`).orderBy("createdAt", "asc").get(),
    hasProjectPermission(user.id, projectId, "member.manage"),
  ]);

  const memberUserIds = membersSnap.docs.map((d) => d.id);
  const userSnaps = memberUserIds.length
    ? await adminDb.getAll(...memberUserIds.map((id) => adminDb.doc(`users/${id}`)))
    : [];
  const userById = new Map(userSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const members = membersSnap.docs.map((d) => {
    const u = userById.get(d.id);
    const role = d.data().role as string;
    return {
      id: d.id,
      role: { id: role, name: role },
      user: { id: d.id, name: u?.name ?? null, email: u?.email ?? "" },
    };
  });

  const roles = Object.keys(DEFAULT_ROLES).map((name) => ({ id: name, name }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Miembros — {project.name}</h1>
        <ProjectNav projectId={projectId} active="members" />
      </header>

      <ProjectMembersManager
        projectId={projectId}
        members={members}
        roles={roles}
        canManage={canManage}
        currentUserId={user.id}
      />
    </main>
  );
}
