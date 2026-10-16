import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { MuralCanvas } from "@/components/mural/MuralCanvas";
import type { MuralElementData } from "@/components/mural/types";

export default async function MuralPage({ params }: { params: Promise<{ boardId: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { boardId } = await params;

  const boardSnap = await adminDb.doc(`boards/${boardId}`).get();
  if (!boardSnap.exists) notFound();
  const board = boardSnap.data()!;
  if (!(await isProjectMember(user.id, board.projectId))) notFound();

  const [projectSnap, elementsSnap, canEdit, taskTypeSnap] = await Promise.all([
    adminDb.doc(`projects/${board.projectId}`).get(),
    adminDb.collection("muralElements").where("boardId", "==", boardId).get(),
    hasProjectPermission(user.id, board.projectId, "mural.edit"),
    adminDb.collection(`projects/${board.projectId}/issueTypes`).where("name", "==", "Tarea").limit(1).get(),
  ]);

  // Build only the fields MuralElementData declares — Firestore Timestamp
  // instances (createdAt/updatedAt) can't cross the server->client RSC
  // boundary as props, so they must not survive into this object.
  const elements = elementsSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        type: data.type,
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        rotation: data.rotation,
        color: data.color,
        zIndex: data.zIndex,
        content: data.content,
        createdById: data.createdById,
      } as MuralElementData;
    })
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <MuralCanvas
      boardId={boardId}
      projectId={board.projectId}
      projectName={`${projectSnap.data()?.name} — ${board.name}`}
      initialElements={elements}
      canEdit={canEdit}
      taskIssueTypeId={taskTypeSnap.empty ? null : taskTypeSnap.docs[0].id}
    />
  );
}
