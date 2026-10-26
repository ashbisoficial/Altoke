import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { BacklogBoard } from "@/components/backlog/BacklogBoard";
import { ProjectNav } from "@/components/project/ProjectNav";

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

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) notFound();
  const project = projectSnap.data()!;

  const [sprintsSnap, issuesSnap] = await Promise.all([
    adminDb.collection("sprints").where("projectId", "==", projectId).orderBy("createdAt", "asc").get(),
    adminDb.collection("issues").where("projectId", "==", projectId).where("parentId", "==", null).get(),
  ]);

  const issues = issuesSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        key: data.key,
        title: data.title,
        sprintId: data.sprintId,
        storyPoints: data.storyPoints,
        issueType: data.issueType,
        status: data.status,
        assignee: data.assignee,
        number: data.number as number,
      };
    })
    .sort((a, b) => a.number - b.number);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Backlog — {project.name}</h1>
        <ProjectNav projectId={projectId} active="backlog" />
      </header>

      <BacklogBoard
        projectId={projectId}
        sprints={sprintsSnap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name,
            status: data.status,
            startDate: tsToISO(data.startDate),
            endDate: tsToISO(data.endDate),
          };
        })}
        initialIssues={issues}
      />
    </main>
  );
}
