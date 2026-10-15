import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id, labelId } = await params;

  const issueRef = adminDb.doc(`issues/${id}`);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) return notFound("Incidencia");
  const issue = issueSnap.data()!;
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return forbidden();

  const remaining = ((issue.labels ?? []) as { label: { id: string } }[]).filter((l) => l.label.id !== labelId);
  await issueRef.update({ labels: remaining, updatedAt: FieldValue.serverTimestamp() });

  return NextResponse.json({ ok: true });
}
