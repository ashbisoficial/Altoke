import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const snap = await adminDb.doc(`testPlans/${id}`).get();
  if (!snap.exists) return notFound("Plan de pruebas");
  const data = snap.data()!;
  if (!(await isProjectMember(user.id, data.projectId))) return forbidden();

  const [sprintSnap, executionsSnap] = await Promise.all([
    data.sprintId ? adminDb.doc(`sprints/${data.sprintId}`).get() : Promise.resolve(null),
    adminDb.collection("testExecutions").where("testPlanId", "==", id).orderBy("createdAt", "asc").get(),
  ]);

  const executions = await Promise.all(
    executionsSnap.docs.map(async (execDoc) => {
      const runsSnap = await adminDb.collection("testRuns").where("executionId", "==", execDoc.id).get();
      return {
        id: execDoc.id,
        name: execDoc.data().name,
        runs: runsSnap.docs.map((r) => ({
          id: r.id,
          status: r.data().status,
          comment: r.data().comment ?? null,
          testCaseId: r.data().testCaseId,
        })),
      };
    }),
  );

  const testPlan = {
    id,
    name: data.name,
    projectId: data.projectId,
    sprint: sprintSnap?.exists ? { id: sprintSnap.id, name: sprintSnap.data()!.name } : null,
    cases: ((data.cases ?? []) as { testCaseId: string; issue: { id: string; key: string; title: string } }[]).map(
      (c) => ({ testCase: { id: c.testCaseId, issue: c.issue } }),
    ),
    executions,
  };

  return NextResponse.json({ testPlan });
}
