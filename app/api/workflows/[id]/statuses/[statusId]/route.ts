import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateStatusSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  category: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]).optional(),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  order: z.number().int().min(0).max(999).optional(),
  isInitial: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId, statusId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "workflow.edit"))) return forbidden();

  const parsed = updateStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = adminDb.doc(`projects/${projectId}`);
  let updatedStatus: Record<string, unknown> | null = null;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const workflow = snap.data()!.workflow ?? { statuses: [], transitions: [] };
    const statuses = [...(workflow.statuses ?? [])] as Record<string, unknown>[];
    const idx = statuses.findIndex((s) => s.id === statusId);
    if (idx === -1) return;

    if (parsed.data.isInitial) {
      for (const s of statuses) s.isInitial = false;
    }
    statuses[idx] = { ...statuses[idx], ...parsed.data };
    updatedStatus = statuses[idx];
    tx.update(ref, { "workflow.statuses": statuses });
  });

  if (!updatedStatus) return notFound("Estado");
  return NextResponse.json({ status: updatedStatus });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; statusId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId, statusId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "workflow.edit"))) return forbidden();

  const issuesInStatus = await adminDb.collection("issues").where("statusId", "==", statusId).limit(1).get();
  if (!issuesInStatus.empty) {
    return errorResponse(409, "No puedes eliminar un estado que tiene incidencias asignadas");
  }

  const ref = adminDb.doc(`projects/${projectId}`);
  let found = false;

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const workflow = snap.data()!.workflow ?? { statuses: [], transitions: [] };
    const statuses = (workflow.statuses ?? []) as { id: string }[];
    if (!statuses.some((s) => s.id === statusId)) return;
    found = true;
    tx.update(ref, { "workflow.statuses": statuses.filter((s) => s.id !== statusId) });
  });

  if (!found) return notFound("Estado");
  return NextResponse.json({ ok: true });
}
