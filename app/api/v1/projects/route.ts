import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-auth";
import {
  CURSOR_ORDER_BY,
  afterCursorWhere,
  decodeCursor,
  pageParams,
  paginate,
  v1Error,
  v1Unauthorized,
  v1ValidationError,
} from "@/lib/api-v1";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return v1Unauthorized();

  const page = pageParams.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!page.success) return v1ValidationError(page.error);
  const { limit, cursor } = page.data;
  const position = cursor ? decodeCursor(cursor) : null;
  if (cursor && !position) return v1Error(422, "Cursor inválido", { code: "invalid_cursor" });

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { members: { some: { userId: user.id } } },
        { organization: { memberships: { some: { userId: user.id } } } },
      ],
      ...(position ? afterCursorWhere(position) : {}),
    },
    select: {
      id: true,
      key: true,
      name: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
      _count: { select: { issues: true } },
    },
    orderBy: CURSOR_ORDER_BY,
    take: limit + 1,
  });

  const { items, nextCursor } = paginate(projects, limit);
  return NextResponse.json({ projects: items, nextCursor });
}
