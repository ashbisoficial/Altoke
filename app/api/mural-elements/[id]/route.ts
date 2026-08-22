import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateElementSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(1).optional(),
  height: z.number().min(1).optional(),
  rotation: z.number().optional(),
  color: z.string().max(50).nullable().optional(),
  zIndex: z.number().int().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

async function loadWithProject(id: string) {
  return prisma.muralElement.findUnique({
    where: { id },
    include: { board: { select: { projectId: true } } },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const element = await loadWithProject(id);
  if (!element) return notFound("Elemento del mural");
  if (!(await hasProjectPermission(user.id, element.board.projectId, "mural.edit"))) return forbidden();

  const parsed = updateElementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const updated = await prisma.muralElement.update({
    where: { id },
    data: { ...parsed.data, content: parsed.data.content as Prisma.InputJsonValue | undefined },
  });
  return NextResponse.json({ element: updated });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const element = await loadWithProject(id);
  if (!element) return notFound("Elemento del mural");
  if (!(await hasProjectPermission(user.id, element.board.projectId, "mural.edit"))) return forbidden();

  await prisma.muralElement.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
