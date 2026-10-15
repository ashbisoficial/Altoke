import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`issueLinks/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Enlace");
  const link = snap.data()!;

  const sourceSnap = await adminDb.doc(`issues/${link.sourceId}`).get();
  const projectId = sourceSnap.data()?.projectId;
  if (!projectId || !(await hasProjectPermission(user.id, projectId, "issue.edit"))) return forbidden();

  await ref.delete();
  return NextResponse.json({ ok: true });
}
