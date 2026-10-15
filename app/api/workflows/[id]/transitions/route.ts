import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const createTransitionSchema = z.object({
  name: z.string().trim().min(1).max(50),
  fromStatusId: z.string().min(1),
  toStatusId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "workflow.edit"))) return forbidden();

  const parsed = createTransitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { fromStatusId, toStatusId, name } = parsed.data;

  if (fromStatusId === toStatusId) {
    return errorResponse(400, "El estado de origen y destino no pueden ser el mismo");
  }

  const ref = adminDb.doc(`projects/${projectId}`);
  const projectSnap = await ref.get();
  if (!projectSnap.exists) return notFound("Proyecto");
  const statuses = (projectSnap.data()!.workflow?.statuses ?? []) as { id: string }[];
  if (!statuses.some((s) => s.id === fromStatusId) || !statuses.some((s) => s.id === toStatusId)) {
    return errorResponse(400, "Ambos estados deben pertenecer a este flujo de trabajo");
  }

  const newTransition = { id: crypto.randomUUID(), name, fromStatusId, toStatusId };

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const workflow = snap.data()!.workflow ?? { statuses: [], transitions: [] };
    const transitions = [...(workflow.transitions ?? []), newTransition];
    tx.update(ref, { "workflow.transitions": transitions });
  });

  return NextResponse.json({ transition: newTransition }, { status: 201 });
}
