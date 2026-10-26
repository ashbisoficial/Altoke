import { notFound, redirect } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { isProjectMember } from "@/lib/permissions";
import { TestCaseDetail } from "@/components/tests/TestCaseDetail";

export default async function TestCasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const snap = await adminDb.doc(`testCases/${id}`).get();
  if (!snap.exists) notFound();
  const data = snap.data()!;
  if (!(await isProjectMember(user.id, data.projectId))) notFound();

  const runsSnap = await adminDb.collection("testRuns").where("testCaseId", "==", id).orderBy("createdAt", "desc").get();
  const runs = runsSnap.docs.map((d) => {
    const r = d.data();
    return { id: d.id, status: r.status, comment: r.comment ?? null, execution: r.execution, executedBy: r.executedBy };
  });

  const requirements = (data.requirements ?? []) as { issue: { id: string; key: string; title: string } }[];
  const linkedIds = new Set(requirements.map((r) => r.issue.id));

  const allRequirementsSnap = await adminDb
    .collection("issues")
    .where("projectId", "==", data.projectId)
    .where("issueType.name", "in", ["Historia", "Épica"])
    .get();
  const otherRequirements = allRequirementsSnap.docs
    .filter((d) => !linkedIds.has(d.id))
    .map((d) => ({ id: d.id, key: d.data().key as string, title: d.data().title as string, number: d.data().number as number }))
    .sort((a, b) => a.number - b.number);

  return (
    <TestCaseDetail
      testCase={{
        id,
        preconditions: data.preconditions,
        steps: data.steps ?? [],
        issue: data.issue,
        requirements,
        runs,
      }}
      otherRequirements={otherRequirements}
    />
  );
}
