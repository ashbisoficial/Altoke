import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  query: z.string().max(2000),
  shared: z.boolean().optional(),
});

/** Filtros guardados que puede ver quien consulta: los compartidos y los suyos. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const filters = await prisma.savedFilter.findMany({
    where: { projectId, OR: [{ shared: true }, { ownerId: user.id }] },
    select: { id: true, name: true, query: true, shared: true, ownerId: true, owner: { select: { name: true, email: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ filters });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const filter = await prisma.savedFilter.create({
    data: {
      projectId,
      ownerId: user.id,
      name: parsed.data.name,
      query: parsed.data.query.replace(/^\?/, ""),
      shared: parsed.data.shared ?? true,
    },
  });
  return NextResponse.json({ filter }, { status: 201 });
}
