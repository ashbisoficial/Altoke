import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { TestCaseDetail } from "@/components/tests/TestCaseDetail";

export default async function TestCasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const testCase = await prisma.testCase.findUnique({
    where: { id },
    include: {
      issue: { select: { id: true, key: true, title: true, projectId: true } },
      requirements: { include: { issue: { select: { id: true, key: true, title: true } } } },
      runs: {
        include: {
          execution: { select: { id: true, name: true, testPlanId: true } },
          executedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!testCase) notFound();
  if (!(await isProjectMember(user.id, testCase.issue.projectId))) notFound();

  const linkedIds = new Set(testCase.requirements.map((r) => r.issue.id));
  const otherRequirements = await prisma.issue.findMany({
    where: {
      projectId: testCase.issue.projectId,
      issueType: { name: { in: ["Historia", "Épica"] } },
      id: { notIn: Array.from(linkedIds) },
    },
    select: { id: true, key: true, title: true },
    orderBy: { number: "asc" },
  });

  return (
    <TestCaseDetail
      testCase={{
        id: testCase.id,
        preconditions: testCase.preconditions,
        steps: (testCase.steps as { step: string; expectedResult?: string }[]) ?? [],
        issue: testCase.issue,
        requirements: testCase.requirements,
        runs: testCase.runs,
      }}
      otherRequirements={otherRequirements}
    />
  );
}
