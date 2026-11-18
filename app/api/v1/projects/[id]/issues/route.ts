import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getApiUser } from "@/lib/api-auth";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { ServiceError, createIssue, createIssueInput } from "@/lib/issue-service";
import {
  CURSOR_ORDER_BY,
  afterCursorWhere,
  decodeCursor,
  pageParams,
  paginate,
  v1Error,
  v1Forbidden,
  v1Unauthorized,
  v1ValidationError,
} from "@/lib/api-v1";

/**
 * Filtros de la API v1 (todos opcionales, combinables):
 *   status        id del estado del workflow
 *   type          id del tipo de incidencia
 *   assignee      id del usuario asignado
 *   sprint        id del sprint
 *   updatedSince  ISO 8601; solo incidencias modificadas desde esa fecha
 * Los nombres antiguos sprintId y assigneeId siguen aceptándose.
 */
const issueFilters = z.object({
  status: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  assignee: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  sprint: z.string().min(1).optional(),
  sprintId: z.string().min(1).optional(),
  updatedSince: z.iso.datetime({ message: "updatedSince debe ser una fecha ISO 8601" }).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return v1Unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return v1Forbidden();

  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const page = pageParams.safeParse(query);
  if (!page.success) return v1ValidationError(page.error);
  const filters = issueFilters.safeParse(query);
  if (!filters.success) return v1ValidationError(filters.error);

  const { limit, cursor } = page.data;
  const f = filters.data;
  const position = cursor ? decodeCursor(cursor) : null;
  if (cursor && !position) return v1Error(422, "Cursor inválido", { code: "invalid_cursor" });

  const assigneeId = f.assignee ?? f.assigneeId;
  const sprintId = f.sprint ?? f.sprintId;

  const issues = await prisma.issue.findMany({
    where: {
      projectId,
      ...(f.status ? { statusId: f.status } : {}),
      ...(f.type ? { issueTypeId: f.type } : {}),
      ...(assigneeId ? { assigneeId } : {}),
      ...(sprintId ? { sprintId } : {}),
      ...(f.updatedSince ? { updatedAt: { gte: new Date(f.updatedSince) } } : {}),
      ...(position ? afterCursorWhere(position) : {}),
    },
    include: {
      issueType: { select: { id: true, name: true, color: true } },
      status: { select: { id: true, name: true, color: true, category: true } },
      assignee: { select: { id: true, name: true, email: true } },
      reporter: { select: { id: true, name: true, email: true } },
    },
    orderBy: CURSOR_ORDER_BY,
    take: limit + 1,
  });

  const { items, nextCursor } = paginate(issues, limit);
  return NextResponse.json({ issues: items, nextCursor });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return v1Unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "issue.create"))) return v1Forbidden();

  const body = await request.json().catch(() => null);
  const parsed = createIssueInput.safeParse({ ...body, projectId });
  if (!parsed.success) return v1ValidationError(parsed.error);

  try {
    const issue = await createIssue(user.id, parsed.data);
    return NextResponse.json({ issue }, { status: 201 });
  } catch (e) {
    if (e instanceof ServiceError) return v1Error(e.status, e.message);
    throw e;
  }
}
