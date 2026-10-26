import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getApiUser } from "@/lib/api-auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, createIssue, createIssueInput } from "@/lib/issue-service";

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
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const searchParams = request.nextUrl.searchParams;
  const sprintId = searchParams.get("sprintId");
  const assigneeId = searchParams.get("assigneeId");

  let query = adminDb.collection("issues").where("projectId", "==", projectId) as FirebaseFirestore.Query;
  if (sprintId) query = query.where("sprintId", "==", sprintId);
  if (assigneeId) query = query.where("assigneeId", "==", assigneeId);

  const snap = await query.get();
  const issues = snap.docs
    .map((d) => serializeIssue(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ issues });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "issue.create"))) return forbidden();

  const body = await request.json().catch(() => null);
  const parsed = createIssueInput.safeParse({ ...body, projectId });
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const issue = await createIssue(user.id, parsed.data);
    return NextResponse.json({ issue: serializeIssue(issue.id, issue) }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
