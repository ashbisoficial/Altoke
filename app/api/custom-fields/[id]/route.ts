import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  position: z.number().int().min(0).max(10000).optional(),
});

async function loadField(id: string) {
  return prisma.customField.findUnique({ where: { id } });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const field = await loadField(id);
  if (!field) return notFound("Campo");
  if (!(await hasProjectPermission(user.id, field.projectId, "project.manage"))) return forbidden();

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { options, ...rest } = parsed.data;

  if (options !== undefined) {
    if (field.type !== "SELECT" && field.type !== "MULTI_SELECT") {
      return errorResponse(422, "Solo los campos de selección tienen opciones");
    }
    if (new Set(options).size !== options.length) return errorResponse(422, "Las opciones no pueden repetirse");
    if (options.length === 0) return errorResponse(422, "Añade al menos una opción");

    // No se puede quitar una opción que ya usa alguna incidencia.
    const current = (field.options as string[] | null) ?? [];
    const removed = current.filter((o) => !options.includes(o));
    if (removed.length > 0) {
      const issues = await prisma.issue.findMany({
        where: { projectId: field.projectId },
        select: { customFields: true },
      });
      const inUse = new Set<string>();
      for (const issue of issues) {
        const value = (issue.customFields as Record<string, unknown>)[field.id];
        const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
        for (const v of values) if (typeof v === "string" && removed.includes(v)) inUse.add(v);
      }
      if (inUse.size > 0) {
        return errorResponse(409, `Hay incidencias que usan estas opciones: ${[...inUse].join(", ")}`);
      }
    }
  }

  const updated = await prisma.customField.update({
    where: { id },
    data: { ...rest, ...(options !== undefined ? { options } : {}) },
  });
  return NextResponse.json({ field: updated });
}

/** Borra el campo y quita su valor de todas las incidencias del proyecto. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const field = await loadField(id);
  if (!field) return notFound("Campo");
  if (!(await hasProjectPermission(user.id, field.projectId, "project.manage"))) return forbidden();

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "Issue" SET "customFields" = "customFields" - ${id} WHERE "projectId" = ${field.projectId} AND "customFields" ? ${id}`;
    await tx.customField.delete({ where: { id } });
  });
  return NextResponse.json({ ok: true });
}
