import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createElementSchema = z.object({
  type: z.enum(["STICKY_NOTE", "TEXT", "FRAME", "IMAGE", "DRAWING"]),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().optional(),
  color: z.string().max(50).optional(),
  zIndex: z.number().int().optional(),
  content: z.record(z.string(), z.unknown()),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: boardId } = await params;

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return notFound("Mural");
  if (!(await isProjectMember(user.id, board.projectId))) return forbidden();

  const elements = await prisma.muralElement.findMany({ where: { boardId }, orderBy: { zIndex: "asc" } });
  return NextResponse.json({ elements });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: boardId } = await params;

  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return notFound("Mural");
  if (!(await hasProjectPermission(user.id, board.projectId, "mural.edit"))) return forbidden();

  const parsed = createElementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const element = await prisma.muralElement.create({
    data: {
      boardId,
      createdById: user.id,
      ...parsed.data,
      content: parsed.data.content as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ element }, { status: 201 });
}
