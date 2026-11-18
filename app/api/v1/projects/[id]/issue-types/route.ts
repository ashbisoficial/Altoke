import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApi } from "@/lib/api-auth";
import { isProjectMember } from "@/lib/permissions";
import {
  decodeIdCursor,
  pageParams,
  paginateById,
  v1Error,
  v1Forbidden,
  v1ValidationError,
} from "@/lib/api-v1";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateApi(request, "READ");
  if (!auth.ok) return auth.response;
  const user = auth.user;
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return v1Forbidden();

  const page = pageParams.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
  if (!page.success) return v1ValidationError(page.error);
  const { limit, cursor } = page.data;
  const afterId = cursor ? decodeIdCursor(cursor) : null;
  if (cursor && !afterId) return v1Error(422, "Cursor inválido", { code: "invalid_cursor" });

  const issueTypes = await prisma.issueType.findMany({
    where: { projectId, ...(afterId ? { id: { lt: afterId } } : {}) },
    select: { id: true, name: true, color: true, isSubtask: true },
    orderBy: { id: "desc" },
    take: limit + 1,
  });

  const { items, nextCursor } = paginateById(issueTypes, limit);
  return NextResponse.json({ issueTypes: items, nextCursor });
}
