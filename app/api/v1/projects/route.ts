import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-auth";
import { unauthorized } from "@/lib/http";

export async function GET(_request: NextRequest) {
  const user = await getApiUser(_request);
  if (!user) return unauthorized();

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { members: { some: { userId: user.id } } },
        { organization: { memberships: { some: { userId: user.id } } } },
      ],
    },
    select: {
      id: true,
      key: true,
      name: true,
      organization: { select: { id: true, name: true } },
      _count: { select: { issues: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}
