import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateRunSchema = z.object({
  status: z.enum(["NOT_RUN", "PASSED", "FAILED", "BLOCKED"]),
  comment: z.string().trim().max(5000).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`testRuns/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Ejecución de prueba");
  const run = snap.data()!;

  const testCaseSnap = await adminDb.doc(`testCases/${run.testCaseId}`).get();
  if (!testCaseSnap.exists) return notFound("Caso de prueba");
  if (!(await hasProjectPermission(user.id, testCaseSnap.data()!.projectId, "testing.manage"))) {
    return forbidden();
  }

  const parsed = updateRunSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { status, comment } = parsed.data;

  const executedBy = { id: user.id, name: user.name, email: user.email };

  await Promise.all([
    ref.update({
      status,
      comment: comment ?? null,
      executedById: user.id,
      executedBy,
      executedAt: FieldValue.serverTimestamp(),
    }),
    adminDb.doc(`testCases/${run.testCaseId}`).update({ lastRunStatus: status }),
  ]);

  const updated = await ref.get();
  const data = updated.data()!;
  return NextResponse.json({
    run: { id, status: data.status, comment: data.comment, testCaseId: data.testCaseId, executedBy: data.executedBy },
  });
}
