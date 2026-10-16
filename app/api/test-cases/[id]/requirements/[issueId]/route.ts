import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; issueId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id, issueId } = await params;

  const ref = adminDb.doc(`testCases/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Caso de prueba");
  const testCase = snap.data()!;
  if (!(await hasProjectPermission(user.id, testCase.projectId, "testing.manage"))) return forbidden();

  const remaining = ((testCase.requirements ?? []) as { issue: { id: string } }[]).filter(
    (r) => r.issue.id !== issueId,
  );
  await ref.update({ requirements: remaining });

  return NextResponse.json({ ok: true });
}
