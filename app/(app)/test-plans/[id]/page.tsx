import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { TestMatrix } from "@/components/tests/TestMatrix";

export default async function TestPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const snap = await adminDb.doc(`testPlans/${id}`).get();
  if (!snap.exists) notFound();
  const testPlan = snap.data()!;
  if (!(await isProjectMember(user.id, testPlan.projectId))) notFound();

  const [projectSnap, executionsSnap, allCasesSnap] = await Promise.all([
    adminDb.doc(`projects/${testPlan.projectId}`).get(),
    adminDb.collection("testExecutions").where("testPlanId", "==", id).orderBy("createdAt", "asc").get(),
    adminDb.collection("testCases").where("projectId", "==", testPlan.projectId).get(),
  ]);

  const executions = await Promise.all(
    executionsSnap.docs.map(async (execDoc) => {
      const runsSnap = await adminDb.collection("testRuns").where("executionId", "==", execDoc.id).get();
      return {
        id: execDoc.id,
        name: execDoc.data().name as string,
        runs: runsSnap.docs.map((r) => ({
          id: r.id,
          status: r.data().status,
          comment: r.data().comment ?? null,
          testCaseId: r.data().testCaseId,
        })),
      };
    }),
  );

  const cases = (testPlan.cases ?? []) as { testCaseId: string; issue: { id: string; key: string; title: string } }[];
  const linkedCaseIds = new Set(cases.map((c) => c.testCaseId));
  const rows = cases.map((c) => ({ testCase: { id: c.testCaseId, issue: c.issue } }));

  const availableCases = allCasesSnap.docs
    .filter((d) => !linkedCaseIds.has(d.id))
    .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0))
    .map((d) => {
      const data = d.data();
      return { id: d.id, issue: { key: data.issue.key as string, title: data.issue.title as string } };
    });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <Link
          href={`/projects/${testPlan.projectId}/tests`}
          className="flex w-fit items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
        >
          <ArrowLeft size={13} />
          Pruebas — {projectSnap.data()?.name}
        </Link>
        <h1 className="font-heading text-2xl font-semibold">{testPlan.name}</h1>
      </header>

      <TestMatrix testPlanId={id} rows={rows} executions={executions} availableCases={availableCases} />
    </main>
  );
}
