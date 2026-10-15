import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const transitionSchema = z.object({
  toStatusId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`issues/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Incidencia");
  const issue = snap.data()!;
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.transition"))) return forbidden();

  const parsed = transitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { toStatusId } = parsed.data;

  if (toStatusId === issue.statusId) {
    return errorResponse(400, "La incidencia ya está en ese estado");
  }

  const projectSnap = await adminDb.doc(`projects/${issue.projectId}`).get();
  const workflow = projectSnap.data()?.workflow;
  const statuses = (workflow?.statuses ?? []) as { id: string; name: string }[];
  const transitions = (workflow?.transitions ?? []) as { fromStatusId: string; toStatusId: string }[];

  // The move is only legal if the project's workflow declares a transition
  // from the issue's current status to the requested one.
  const allowed = transitions.some((t) => t.fromStatusId === issue.statusId && t.toStatusId === toStatusId);
  if (!allowed) {
    return errorResponse(422, "Esa transición no está permitida por el flujo de trabajo del proyecto");
  }

  const newStatus = statuses.find((s) => s.id === toStatusId);
  if (!newStatus) return errorResponse(400, "Estado inválido");

  await ref.update({ statusId: toStatusId, status: newStatus, updatedAt: FieldValue.serverTimestamp() });
  await ref.collection("activity").add({
    actorId: user.id,
    actor: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
    field: "status",
    fromLabel: issue.status?.name ?? null,
    toLabel: newStatus.name,
    createdAt: FieldValue.serverTimestamp(),
  });

  const updated = await ref.get();
  const data = updated.data()!;
  return NextResponse.json({
    issue: { id, ...data, dueDate: tsToISO(data.dueDate), createdAt: tsToISO(data.createdAt), updatedAt: tsToISO(data.updatedAt) },
  });
}
