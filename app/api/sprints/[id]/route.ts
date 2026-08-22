import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateSprintSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  goal: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) return notFound("Sprint");
  if (!(await hasProjectPermission(user.id, sprint.projectId, "sprint.manage"))) return forbidden();

  const parsed = updateSprintSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { startDate, endDate, ...rest } = parsed.data;

  const updated = await prisma.sprint.update({
    where: { id },
    data: {
      ...rest,
      ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
    },
  });

  return NextResponse.json({ sprint: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const sprint = await prisma.sprint.findUnique({ where: { id } });
  if (!sprint) return notFound("Sprint");
  if (!(await hasProjectPermission(user.id, sprint.projectId, "sprint.manage"))) return forbidden();

  await prisma.sprint.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
