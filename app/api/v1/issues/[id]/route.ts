import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getApiUser } from "@/lib/api-auth";
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await params;

  const snap = await adminDb.doc(`issues/${id}`).get();
  if (!snap.exists) return notFound("Incidencia");
  const data = snap.data()!;
  if (!(await isProjectMember(user.id, data.projectId))) return forbidden();

  return NextResponse.json({ issue: serializeIssue(id, data) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
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
