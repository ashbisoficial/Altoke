import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { ProjectNav } from "@/components/project/ProjectNav";
import { ProjectCalendar } from "@/components/calendar/ProjectCalendar";

export default async function ProjectCalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) notFound();
  const project = projectSnap.data()!;

  const [issuesSnap, sprintsSnap] = await Promise.all([
    adminDb.collection("issues").where("projectId", "==", projectId).get(),
    adminDb.collection("sprints").where("projectId", "==", projectId).get(),
  ]);

  const issues = issuesSnap.docs
    .map((d) => {
      const data = d.data();
      const dueDate = tsToISO(data.dueDate);
      return dueDate
        ? { id: d.id, key: data.key as string, title: data.title as string, dueDate, issueType: data.issueType }
        : null;
    })
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const sprints = sprintsSnap.docs
    .sort((a, b) => (a.data().createdAt?.toMillis?.() ?? 0) - (b.data().createdAt?.toMillis?.() ?? 0))
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name as string,
        status: data.status,
        startDate: tsToISO(data.startDate),
        endDate: tsToISO(data.endDate),
      };
    });

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Calendario — {project.name}</h1>
        <ProjectNav projectId={projectId} active="calendar" />
      </header>

      <ProjectCalendar issues={issues} sprints={sprints} />
    </main>
  );
}
