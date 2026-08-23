import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const label = await prisma.label.findUnique({ where: { id } });
  if (!label) return notFound("Etiqueta");
  if (!(await hasProjectPermission(user.id, label.projectId, "issue.edit"))) return forbidden();

  await prisma.label.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
