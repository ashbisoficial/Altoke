import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`attachments/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Adjunto");
  const attachment = snap.data()!;

  const issueSnap = await adminDb.doc(`issues/${attachment.issueId}`).get();
  const projectId = issueSnap.data()?.projectId;

  const canDelete =
    attachment.uploaderId === user.id || (projectId && (await hasProjectPermission(user.id, projectId, "issue.edit")));
  if (!canDelete) return forbidden();

  await ref.delete();
  return NextResponse.json({ ok: true });
}
