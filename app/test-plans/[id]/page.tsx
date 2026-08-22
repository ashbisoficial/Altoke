import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { TestMatrix } from "@/components/tests/TestMatrix";

export default async function TestPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const testPlan = await prisma.testPlan.findUnique({
    where: { id },
    include: {
      project: { select: { id: true, name: true } },
      cases: {
        include: {
          testCase: { include: { issue: { select: { id: true, key: true, title: true } } } },
        },
      },
      executions: {
        include: { runs: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!testPlan) notFound();
  if (!(await isProjectMember(user.id, testPlan.projectId))) notFound();

  const linkedCaseIds = new Set(testPlan.cases.map((c) => c.testCaseId));
  const availableCases = await prisma.testCase.findMany({
    where: { issue: { projectId: testPlan.projectId }, id: { notIn: Array.from(linkedCaseIds) } },
    include: { issue: { select: { key: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6">
        <Link
          href={`/projects/${testPlan.projectId}/tests`}
          className="flex w-fit items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
        >
          <ArrowLeft size={13} />
          Pruebas — {testPlan.project.name}
        </Link>
        <h1 className="font-heading text-2xl font-semibold">{testPlan.name}</h1>
      </header>

      <TestMatrix
        testPlanId={testPlan.id}
        rows={testPlan.cases}
        executions={testPlan.executions}
        availableCases={availableCases}
      />
    </main>
  );
}
