import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";
import { customFieldDefinitionInput } from "@/lib/custom-fields";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const fields = await prisma.customField.findMany({ where: { projectId }, orderBy: { position: "asc" } });
  return NextResponse.json({ fields });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;
  if (!(await hasProjectPermission(user.id, projectId, "project.manage"))) return forbidden();

  const parsed = customFieldDefinitionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { name, type, options, required } = parsed.data;

  const last = await prisma.customField.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  try {
    const field = await prisma.customField.create({
      data: {
        projectId,
        name,
        type,
        options: options ?? undefined,
        required: required ?? false,
        position: (last?.position ?? -1) + 1,
      },
    });
    return NextResponse.json({ field }, { status: 201 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return errorResponse(409, "Ya existe un campo con ese nombre en el proyecto");
    }
    throw e;
  }
}
