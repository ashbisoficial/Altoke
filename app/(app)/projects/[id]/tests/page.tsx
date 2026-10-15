import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { TestCaseForm } from "@/components/tests/TestCaseForm";
import { TestPlanForm } from "@/components/tests/TestPlanForm";
import { ProjectNav } from "@/components/project/ProjectNav";

const RUN_STATUS_COLOR: Record<string, string> = {
  PASSED: "#16A34A",
  FAILED: "#DC2626",
  BLOCKED: "#D97706",
  NOT_RUN: "#94A3B8",
};

export default async function ProjectTestsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) notFound();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) notFound();
  const project = projectSnap.data()!;

  const [testCasesSnap, testPlansSnap, requirementIssuesSnap] = await Promise.all([
    adminDb.collection("testCases").where("projectId", "==", projectId).get(),
    adminDb.collection("testPlans").where("projectId", "==", projectId).get(),
    adminDb
      .collection("issues")
      .where("projectId", "==", projectId)
      .where("issueType.name", "in", ["Historia", "Épica"])
      .get(),
  ]);

  const testCases = testCasesSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        issue: data.issue as { id: string; key: string; title: string },
        requirements: (data.requirements ?? []) as { issue: { id: string } }[],
        lastRunStatus: (data.lastRunStatus ?? "NOT_RUN") as string,
        createdAt: data.createdAt,
      };
    })
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const testPlans = await Promise.all(
    testPlansSnap.docs.map(async (d) => {
      const data = d.data();
      const executionCount = await adminDb.collection("testExecutions").where("testPlanId", "==", d.id).count().get();
      return {
        id: d.id,
        name: data.name as string,
        createdAt: data.createdAt,
        _count: { cases: (data.cases ?? []).length, executions: executionCount.data().count },
      };
    }),
  );
  testPlans.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));

  const requirementIssues = requirementIssuesSnap.docs
    .map((d) => ({ id: d.id, key: d.data().key as string, title: d.data().title as string, number: d.data().number as number }))
    .sort((a, b) => a.number - b.number);

  const coveredRequirementIds = new Set(testCases.flatMap((tc) => tc.requirements.map((r) => r.issue.id)));
  const coveragePct =
    requirementIssues.length === 0 ? null : Math.round((coveredRequirementIds.size / requirementIssues.length) * 100);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-col gap-3">
        <h1 className="font-heading text-2xl font-semibold">Pruebas — {project.name}</h1>
        <ProjectNav projectId={projectId} active="tests" />
      </header>

      {coveragePct !== null && (
        <div className="shadow-soft mb-6 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Cobertura de requisitos</span>
            <span className="font-mono">
              {coveredRequirementIds.size}/{requirementIssues.length} ({coveragePct}%)
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-bg">
            <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${coveragePct}%` }} />
          </div>
        </div>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Casos de prueba</h2>
          <TestCaseForm projectId={projectId} requirements={requirementIssues} />
        </div>
        {testCases.length === 0 ? (
          <p className="text-sm text-ink/60">No hay casos de prueba todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {testCases.map((tc) => (
              <li key={tc.id}>
                <Link
                  href={`/tests/${tc.id}`}
                  className="shadow-soft-hover flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: RUN_STATUS_COLOR[tc.lastRunStatus] }}
                    title={tc.lastRunStatus}
                  />
                  <span className="font-mono text-xs text-accent">{tc.issue.key}</span>
                  <span className="flex-1 truncate">{tc.issue.title}</span>
                  <span className="shrink-0 text-xs text-ink/50">
                    {tc.requirements.length} requisito{tc.requirements.length === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Planes de pruebas</h2>
          <TestPlanForm projectId={projectId} />
        </div>
        {testPlans.length === 0 ? (
          <p className="text-sm text-ink/60">No hay planes de pruebas todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {testPlans.map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/test-plans/${plan.id}`}
                  className="shadow-soft-hover flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
                >
                  <span className="flex-1 font-medium">{plan.name}</span>
                  <span className="shrink-0 text-xs text-ink/50">
                    {plan._count.cases} casos · {plan._count.executions} ejecuciones
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
