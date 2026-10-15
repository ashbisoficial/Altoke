import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const stepSchema = z.object({
  step: z.string().trim().min(1).max(2000),
  expectedResult: z.string().trim().max(2000).optional(),
});

const updateTestCaseSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  preconditions: z.string().trim().max(5000).nullable().optional(),
  steps: z.array(stepSchema).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const snap = await adminDb.doc(`testCases/${id}`).get();
  if (!snap.exists) return notFound("Caso de prueba");
  const data = snap.data()!;
  if (!(await isProjectMember(user.id, data.projectId))) return forbidden();

  const runsSnap = await adminDb.collection("testRuns").where("testCaseId", "==", id).orderBy("createdAt", "desc").get();

  const testCase = {
    id,
    preconditions: data.preconditions,
    steps: data.steps ?? [],
    issue: data.issue,
    requirements: data.requirements ?? [],
    runs: runsSnap.docs.map((d) => {
      const r = d.data();
      return { id: d.id, status: r.status, comment: r.comment ?? null, execution: r.execution, executedBy: r.executedBy };
    }),
  };

  return NextResponse.json({ testCase });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`testCases/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Caso de prueba");
  const data = snap.data()!;
  if (!(await hasProjectPermission(user.id, data.projectId, "testing.manage"))) return forbidden();

  const parsed = updateTestCaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { title, ...testCaseFields } = parsed.data;

  const batch = adminDb.batch();
  batch.update(ref, testCaseFields);
  if (title) {
    batch.update(adminDb.doc(`issues/${id}`), { title, updatedAt: FieldValue.serverTimestamp() });
    batch.update(ref, { "issue.title": title });
  }
  await batch.commit();

  const updated = await ref.get();
  const updatedData = updated.data()!;
  return NextResponse.json({
    testCase: {
      id,
      preconditions: updatedData.preconditions,
      steps: updatedData.steps ?? [],
      issue: updatedData.issue,
      requirements: updatedData.requirements ?? [],
    },
  });
}
