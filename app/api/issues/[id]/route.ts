import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, updateIssue, updateIssueInput } from "@/lib/issue-service";

function serializeIssue(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    ...data,
    dueDate: tsToISO(data.dueDate),
    createdAt: tsToISO(data.createdAt),
    updatedAt: tsToISO(data.updatedAt),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`issues/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Incidencia");
  const data = snap.data()!;
  if (!(await isProjectMember(user.id, data.projectId))) return forbidden();

  const [commentsSnap, attachmentsSnap, childrenSnap, parentSnap, linksFromSnap, linksToSnap, activitySnap] =
    await Promise.all([
      adminDb.collection("comments").where("issueId", "==", id).orderBy("createdAt", "asc").get(),
      adminDb.collection("attachments").where("issueId", "==", id).orderBy("createdAt", "desc").get(),
      adminDb.collection("issues").where("parentId", "==", id).orderBy("number", "asc").get(),
      data.parentId ? adminDb.doc(`issues/${data.parentId}`).get() : Promise.resolve(null),
      adminDb.collection("issueLinks").where("sourceId", "==", id).orderBy("createdAt", "asc").get(),
      adminDb.collection("issueLinks").where("targetId", "==", id).orderBy("createdAt", "asc").get(),
      ref.collection("activity").orderBy("createdAt", "desc").limit(30).get(),
    ]);

  const issue = {
    ...serializeIssue(id, data),
    comments: commentsSnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToISO(d.data().createdAt) })),
    attachments: attachmentsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      createdAt: tsToISO(d.data().createdAt),
    })),
    children: childrenSnap.docs.map((d) => serializeIssue(d.id, d.data())),
    parent: parentSnap?.exists ? { id: parentSnap.id, key: parentSnap.data()!.key, title: parentSnap.data()!.title } : null,
    linksFrom: linksFromSnap.docs.map((d) => ({ id: d.id, type: d.data().type, target: d.data().target })),
    linksTo: linksToSnap.docs.map((d) => ({ id: d.id, type: d.data().type, source: d.data().source })),
    activity: activitySnap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: tsToISO(d.data().createdAt) })),
  };

  return NextResponse.json({ issue });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await adminDb.doc(`issues/${id}`).get();
  if (!existing.exists) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, existing.data()!.projectId, "issue.edit"))) return forbidden();

  const parsed = updateIssueInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const issue = await updateIssue(user.id, id, parsed.data);
    return NextResponse.json({ issue: serializeIssue(issue.id, issue) });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const existing = await adminDb.doc(`issues/${id}`).get();
  if (!existing.exists) return notFound("Incidencia");
  const issue = existing.data()!;
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.delete"))) return forbidden();

  await adminDb.doc(`issues/${id}`).delete();
  if (issue.parentId) {
    adminDb
      .doc(`issues/${issue.parentId}`)
      .update({ childCount: FieldValue.increment(-1) })
      .catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
