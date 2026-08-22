import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const link = await prisma.issueLink.findUnique({
    where: { id },
    include: { source: { select: { projectId: true } } },
  });
  if (!link) return notFound("Enlace");
  if (!(await hasProjectPermission(user.id, link.source.projectId, "issue.edit"))) return forbidden();

  await prisma.issueLink.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
