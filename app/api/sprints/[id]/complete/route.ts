import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { ServiceError } from "@/lib/issue-service";
import { completeSprint, completeSprintInput } from "@/lib/sprint-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const sprint = await prisma.sprint.findUnique({ where: { id }, select: { projectId: true } });
  if (!sprint) return notFound("Sprint");
  if (!(await hasProjectPermission(user.id, sprint.projectId, "sprint.manage"))) return forbidden();

  const body = await request.json().catch(() => ({}));
  const parsed = completeSprintInput.safeParse(body ?? {});
  if (!parsed.success) return zodErrorResponse(parsed.error);

  try {
    const result = await completeSprint(user.id, id, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message, e.fields);
    throw e;
  }
}
