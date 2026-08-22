import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { TestCaseForm } from "@/components/tests/TestCaseForm";
import { TestPlanForm } from "@/components/tests/TestPlanForm";

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

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  const [testCases, testPlans, requirementIssues] = await Promise.all([
    prisma.testCase.findMany({
      where: { issue: { projectId } },
      include: {
        issue: { select: { id: true, key: true, title: true } },
        requirements: { select: { issueId: true } },
        runs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testPlan.findMany({
      where: { projectId },
      include: { _count: { select: { cases: true, executions: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.issue.findMany({
      where: { projectId, issueType: { name: { in: ["Historia", "Épica"] } } },
      select: { id: true, key: true, title: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const coveredRequirementIds = new Set(
    testCases.flatMap((tc) => tc.requirements.map((r) => r.issueId)),
  );
  const coveragePct =
    requirementIssues.length === 0
      ? null
      : Math.round((coveredRequirementIds.size / requirementIssues.length) * 100);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <Link href={`/board?projectId=${project.id}`} className="text-xs text-accent underline underline-offset-4">
          ← Tablero
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Pruebas — {project.name}</h1>
      </header>

      {coveragePct !== null && (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Cobertura de requisitos</span>
            <span className="font-mono">
              {coveredRequirementIds.size}/{requirementIssues.length} ({coveragePct}%)
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-bg">
            <div
              className="h-2 rounded-full bg-accent transition-all"
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>
      )}

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Casos de prueba</h2>
          <TestCaseForm projectId={project.id} requirements={requirementIssues} />
        </div>
        {testCases.length === 0 ? (
          <p className="text-sm text-ink/60">No hay casos de prueba todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {testCases.map((tc) => {
              const lastStatus = tc.runs[0]?.status ?? "NOT_RUN";
              return (
                <li key={tc.id}>
                  <Link
                    href={`/tests/${tc.id}`}
                    className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: RUN_STATUS_COLOR[lastStatus] }}
                      title={lastStatus}
                    />
                    <span className="font-mono text-xs text-accent">{tc.issue.key}</span>
                    <span className="flex-1 truncate">{tc.issue.title}</span>
                    <span className="shrink-0 text-xs text-ink/50">
                      {tc.requirements.length} requisito{tc.requirements.length === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Planes de pruebas</h2>
          <TestPlanForm projectId={project.id} />
        </div>
        {testPlans.length === 0 ? (
          <p className="text-sm text-ink/60">No hay planes de pruebas todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {testPlans.map((plan) => (
              <li key={plan.id}>
                <Link
                  href={`/test-plans/${plan.id}`}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:border-accent"
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
