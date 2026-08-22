import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/http";
import { isOrgMember } from "@/lib/permissions";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();

  const roles = await prisma.role.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ roles });
}
