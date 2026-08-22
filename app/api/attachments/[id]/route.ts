import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { issue: { select: { projectId: true } } },
  });
  if (!attachment) return notFound("Adjunto");

  const canDelete =
    attachment.uploaderId === user.id ||
    (await hasProjectPermission(user.id, attachment.issue.projectId, "issue.edit"));
  if (!canDelete) return forbidden();

  await prisma.attachment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
