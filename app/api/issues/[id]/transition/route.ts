import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { ServiceError, transitionIssue } from "@/lib/issue-service";

const transitionSchema = z.object({
  toStatusId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({ where: { id }, select: { projectId: true } });
  if (!issue) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.transition"))) {
    return forbidden();
  }

  const parsed = transitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const updated = await transitionIssue(user.id, id, parsed.data.toStatusId);
    return NextResponse.json({ issue: updated });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message, e.fields);
    throw e;
  }
}
