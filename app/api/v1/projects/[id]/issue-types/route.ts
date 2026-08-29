import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-auth";
import { forbidden, unauthorized } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const issueTypes = await prisma.issueType.findMany({
    where: { projectId },
    select: { id: true, name: true, color: true, isSubtask: true },
  });

  return NextResponse.json({ issueTypes });
}
