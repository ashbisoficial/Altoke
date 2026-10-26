import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
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

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const params = request.nextUrl.searchParams;
  const projectId = params.get("projectId");
  if (!projectId) return errorResponse(400, "projectId es requerido");
  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const sprintId = params.get("sprintId");
  const assigneeId = params.get("assigneeId");
  const parentId = params.get("parentId");

  let query = adminDb.collection("issues").where("projectId", "==", projectId) as FirebaseFirestore.Query;
  if (sprintId) query = query.where("sprintId", "==", sprintId);
  if (assigneeId) query = query.where("assigneeId", "==", assigneeId);
  if (parentId !== null) query = query.where("parentId", "==", parentId || null);

  const snap = await query.get();
  const issues = snap.docs
    .map((d) => serializeIssue(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ issues });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createIssueInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  if (!(await hasProjectPermission(user.id, parsed.data.projectId, "issue.create"))) return forbidden();

  try {
    const issue = await createIssue(user.id, parsed.data);
    return NextResponse.json({ issue: serializeIssue(issue.id, issue) }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
