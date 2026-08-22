import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { MuralCanvas } from "@/components/mural/MuralCanvas";

export default async function MuralPage({ params }: { params: Promise<{ boardId: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { boardId } = await params;

  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!board) notFound();
  if (!(await isProjectMember(user.id, board.projectId))) notFound();

  const [elements, canEdit, taskType] = await Promise.all([
    prisma.muralElement.findMany({ where: { boardId }, orderBy: { zIndex: "asc" } }),
    hasProjectPermission(user.id, board.projectId, "mural.edit"),
    prisma.issueType.findFirst({ where: { projectId: board.projectId, name: "Tarea" } }),
  ]);

  return (
    <MuralCanvas
      boardId={board.id}
      projectId={board.project.id}
      projectName={`${board.project.name} — ${board.name}`}
      initialElements={elements.map((e) => ({
        ...e,
        content: e.content as Record<string, unknown>,
      }))}
      canEdit={canEdit}
      taskIssueTypeId={taskType?.id ?? null}
    />
  );
}
