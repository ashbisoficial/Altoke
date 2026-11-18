import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { ServiceError } from "@/lib/issue-service";
import { restoreTestCase } from "@/lib/trash-service";

/** Restaura un caso de prueba de la papelera. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const testCase = await prisma.testCase.findUnique({
    where: { id, deletedAt: { not: null } },
    select: { issue: { select: { projectId: true } } },
  });
  if (!testCase) return notFound("Caso en la papelera");
  if (!(await hasProjectPermission(user.id, testCase.issue.projectId, "testing.manage"))) return forbidden();

  try {
    await restoreTestCase(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message);
    throw e;
  }
}
