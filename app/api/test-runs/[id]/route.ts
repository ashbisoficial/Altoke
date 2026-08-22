import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateRunSchema = z.object({
  status: z.enum(["NOT_RUN", "PASSED", "FAILED", "BLOCKED"]),
  comment: z.string().trim().max(5000).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const run = await prisma.testRun.findUnique({
    where: { id },
    include: { testCase: { include: { issue: { select: { projectId: true } } } } },
  });
  if (!run) return notFound("Ejecución de prueba");
  if (!(await hasProjectPermission(user.id, run.testCase.issue.projectId, "testing.manage"))) {
    return forbidden();
  }

  const parsed = updateRunSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { status, comment } = parsed.data;

  const updated = await prisma.testRun.update({
    where: { id },
    data: {
      status,
      comment,
      executedById: user.id,
      executedAt: new Date(),
    },
    include: { executedBy: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json({ run: updated });
}
