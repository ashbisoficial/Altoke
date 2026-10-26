import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const createExecutionSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: testPlanId } = await params;

  const planSnap = await adminDb.doc(`testPlans/${testPlanId}`).get();
  if (!planSnap.exists) return notFound("Plan de pruebas");
  const testPlan = planSnap.data()!;
  if (!(await hasProjectPermission(user.id, testPlan.projectId, "testing.manage"))) return forbidden();

  const cases = (testPlan.cases ?? []) as { testCaseId: string }[];
  if (cases.length === 0) {
    return errorResponse(400, "Añade al menos un caso de prueba al plan antes de crear una ejecución");
  }

  const parsed = createExecutionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const executionRef = await adminDb.collection("testExecutions").add({
    testPlanId,
    name: parsed.data.name,
    createdAt: FieldValue.serverTimestamp(),
  });

  const batch = adminDb.batch();
  const runs = cases.map((c) => {
    const runRef = adminDb.collection("testRuns").doc();
    batch.set(runRef, {
      executionId: executionRef.id,
      testCaseId: c.testCaseId,
      status: "NOT_RUN",
      comment: null,
      executedById: null,
      executedBy: null,
      executedAt: null,
      execution: { id: executionRef.id, name: parsed.data.name, testPlanId },
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: runRef.id, status: "NOT_RUN", comment: null, testCaseId: c.testCaseId };
  });
  await batch.commit();

  return NextResponse.json(
    { execution: { id: executionRef.id, name: parsed.data.name, runs } },
    { status: 201 },
  );
}
