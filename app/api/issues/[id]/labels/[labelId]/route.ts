import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; labelId: string }> },
) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id, labelId } = await params;

  const issue = await prisma.issue.findUnique({ where: { id } });
  if (!issue) return notFound("Incidencia");
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return forbidden();

  await prisma.issueLabel.deleteMany({ where: { issueId: id, labelId } });
  return NextResponse.json({ ok: true });
}
