import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";
import { hasProjectPermission } from "@/lib/permissions";
import { ServiceError } from "@/lib/issue-service";
import { moveIssueRank, placementInput } from "@/lib/rank-service";
import { v1Error, v1Forbidden, v1NotFound, v1ValidationError } from "@/lib/api-v1";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "WRITE");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id } = await params;

  const issue = await prisma.issue.findUnique({ where: { id }, select: { projectId: true } });
  if (!issue) return v1NotFound("Incidencia");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return v1Forbidden();

  const parsed = placementInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return v1ValidationError(parsed.error);

  try {
    const updated = await moveIssueRank(id, parsed.data);
    return NextResponse.json({ issue: { id: updated.id, rank: updated.rank } });
  } catch (e) {
    if (e instanceof ServiceError) return v1Error(e.status, e.message, { fields: e.fields });
    throw e;
  }
}
