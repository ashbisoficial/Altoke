import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ issues: [] });

  const issues = await prisma.issue.findMany({
    where: {
      project: {
        OR: [
          { members: { some: { userId: user.id } } },
          { organization: { memberships: { some: { userId: user.id } } } },
        ],
      },
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { key: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      key: true,
      title: true,
      project: { select: { key: true, name: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  return NextResponse.json({ issues });
}
