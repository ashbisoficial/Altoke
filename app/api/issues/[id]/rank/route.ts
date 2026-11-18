import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { ServiceError } from "@/lib/issue-service";
import { moveIssueRank, placementInput } from "@/lib/rank-service";

/** Coloca la incidencia entre previousId y nextId (ver lib/rank-service.ts). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({ where: { id }, select: { projectId: true } });
  if (!issue) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return forbidden();

  const parsed = placementInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const updated = await moveIssueRank(id, parsed.data);
    return NextResponse.json({ issue: { id: updated.id, rank: updated.rank } });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
