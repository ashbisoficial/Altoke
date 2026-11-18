import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";

/** Solo quien creó el filtro puede borrarlo. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const filter = await prisma.savedFilter.findUnique({ where: { id }, select: { ownerId: true } });
  if (!filter) return notFound("Filtro");
  if (filter.ownerId !== user.id) return forbidden();

  await prisma.savedFilter.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
