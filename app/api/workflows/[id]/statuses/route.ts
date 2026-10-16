import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

/**
 * The workflow lives embedded on the project doc (projects/{id}.workflow),
 * not as its own collection — there's a 1:1 relationship, so the project id
 * doubles as the "workflow id" the frontend already had a slot for.
 */
const createStatusSchema = z.object({
  name: z.string().trim().min(1).max(50),
  category: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido, usa formato #RRGGBB"),
  order: z.number().int().min(0).max(999).optional(),
  isInitial: z.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "workflow.edit"))) return forbidden();

  const parsed = createStatusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { isInitial, ...rest } = parsed.data;

  const ref = adminDb.doc(`projects/${projectId}`);
  const projectSnap = await ref.get();
  if (!projectSnap.exists) return notFound("Proyecto");

  const newStatus = { id: crypto.randomUUID(), isInitial: isInitial ?? false, order: 0, ...rest };

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const workflow = snap.data()!.workflow ?? { statuses: [], transitions: [] };
    const statuses = [...(workflow.statuses ?? [])];
    if (newStatus.isInitial) {
      for (const s of statuses) s.isInitial = false;
    }
    statuses.push(newStatus);
    tx.update(ref, { "workflow.statuses": statuses });
  });

  return NextResponse.json({ status: newStatus }, { status: 201 });
}
