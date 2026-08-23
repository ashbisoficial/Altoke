import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color inválido"),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "issue.edit"))) return forbidden();

  const parsed = createLabelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { name, color } = parsed.data;

  const existing = await prisma.label.findUnique({ where: { projectId_name: { projectId, name } } });
  if (existing) return errorResponse(409, "Ya existe una etiqueta con ese nombre en este proyecto");

  const label = await prisma.label.create({ data: { projectId, name, color } });
  return NextResponse.json({ label }, { status: 201 });
}
