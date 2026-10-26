import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; transitionId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId, transitionId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "workflow.edit"))) return forbidden();

  const ref = adminDb.doc(`projects/${projectId}`);
  let found = false;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const workflow = snap.data()!.workflow ?? { statuses: [], transitions: [] };
    const transitions = (workflow.transitions ?? []) as { id: string }[];
    if (!transitions.some((t) => t.id === transitionId)) return;
    found = true;
    tx.update(ref, { "workflow.transitions": transitions.filter((t) => t.id !== transitionId) });
  });

  if (!found) return notFound("Transición");
  return NextResponse.json({ ok: true });
}
