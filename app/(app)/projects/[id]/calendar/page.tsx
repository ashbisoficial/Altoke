import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { ProjectNav } from "@/components/project/ProjectNav";
import { ProjectCalendar } from "@/components/calendar/ProjectCalendar";

export default async function ProjectCalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const [issues, sprints] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId, dueDate: { not: null } },
      select: { id: true, key: true, title: true, dueDate: true, issueType: { select: { name: true, color: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.sprint.findMany({
      where: { projectId },
      select: { id: true, name: true, status: true, startDate: true, endDate: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <header className="mb-5 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Calendario — {project.name}</h1>
        <ProjectNav projectId={project.id} active="calendar" />
      </header>

      <ProjectCalendar
        issues={issues.map((i) => ({ ...i, dueDate: i.dueDate!.toISOString() }))}
        sprints={sprints.map((s) => ({
          ...s,
          startDate: s.startDate?.toISOString() ?? null,
          endDate: s.endDate?.toISOString() ?? null,
        }))}
      />
    </main>
  );
}
