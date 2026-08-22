import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["KANBAN", "SCRUM", "MURAL"]).default("MURAL"),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const type = request.nextUrl.searchParams.get("type");

  const boards = await prisma.board.findMany({
    where: { projectId, ...(type ? { type: type as "KANBAN" | "SCRUM" | "MURAL" } : {}) },
    include: { _count: { select: { muralElements: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ boards });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "mural.edit"))) return forbidden();

  const parsed = createBoardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const board = await prisma.board.create({ data: { projectId, ...parsed.data } });
  return NextResponse.json({ board }, { status: 201 });
}
