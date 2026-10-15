import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const addCaseSchema = z.object({
  testCaseId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: testPlanId } = await params;

  const planRef = adminDb.doc(`testPlans/${testPlanId}`);
  const planSnap = await planRef.get();
  if (!planSnap.exists) return notFound("Plan de pruebas");
  const testPlan = planSnap.data()!;
  if (!(await hasProjectPermission(user.id, testPlan.projectId, "testing.manage"))) return forbidden();

  const parsed = addCaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const testCaseSnap = await adminDb.doc(`testCases/${parsed.data.testCaseId}`).get();
  if (!testCaseSnap.exists || testCaseSnap.data()!.projectId !== testPlan.projectId) {
    return errorResponse(400, "El caso de prueba debe pertenecer al mismo proyecto");
  }
  const testCase = testCaseSnap.data()!;

  const existingCases = (testPlan.cases ?? []) as { testCaseId: string }[];
  if (existingCases.some((c) => c.testCaseId === testCaseSnap.id)) {
    return errorResponse(409, "Ese caso ya está en el plan");
  }

  const entry = { testCaseId: testCaseSnap.id, issue: testCase.issue };
  await planRef.update({ cases: FieldValue.arrayUnion(entry) });

  return NextResponse.json({ link: { testCase: { id: testCaseSnap.id, issue: testCase.issue } } }, { status: 201 });
}
