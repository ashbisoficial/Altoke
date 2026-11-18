import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { ServiceError } from "@/lib/issue-service";
import { restoreIssue } from "@/lib/trash-service";

/** Restaura una incidencia de la papelera, con sus subtareas (F0-8). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  // Hay que nombrar deletedAt para ver registros borrados (ver lib/prisma.ts).
  const issue = await prisma.issue.findUnique({
    where: { id, deletedAt: { not: null } },
    select: { projectId: true },
  });
  if (!issue) return notFound("Incidencia en la papelera");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.delete"))) return forbidden();

  try {
    return NextResponse.json(await restoreIssue(id));
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
