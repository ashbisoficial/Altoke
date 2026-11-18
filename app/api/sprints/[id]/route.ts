import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { ServiceError } from "@/lib/issue-service";
import { assertValidSprintDates } from "@/lib/sprint-service";

const updateSprintSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  goal: z.string().trim().max(1000).nullable().optional(),
  // El estado no se cambia aquí: iniciar y completar tienen reglas propias
  // (POST /api/sprints/:id/start y /complete). Se detecta abajo para dar 409.
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
  const { startDate, endDate, status, ...rest } = parsed.data;
  if (status !== undefined) {
    return errorResponse(409, "Para cambiar el estado usa POST /api/sprints/:id/start o /complete");
  }

  // Valida el rango con las fechas que quedarían tras el cambio.
  const nextStart = startDate !== undefined ? (startDate ? new Date(startDate) : null) : sprint.startDate;
  const nextEnd = endDate !== undefined ? (endDate ? new Date(endDate) : null) : sprint.endDate;
  try {
    assertValidSprintDates(nextStart, nextEnd);
  } catch (e) {
    if (e instanceof ServiceError) return errorResponse(e.status, e.message, e.fields);
    throw e;
  }

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
