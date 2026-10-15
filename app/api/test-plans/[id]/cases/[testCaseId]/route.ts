import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; testCaseId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: testPlanId, testCaseId } = await params;

  const ref = adminDb.doc(`testPlans/${testPlanId}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Plan de pruebas");
  const testPlan = snap.data()!;
  if (!(await hasProjectPermission(user.id, testPlan.projectId, "testing.manage"))) return forbidden();

  const remaining = ((testPlan.cases ?? []) as { testCaseId: string }[]).filter((c) => c.testCaseId !== testCaseId);
  await ref.update({ cases: remaining });

  return NextResponse.json({ ok: true });
}
