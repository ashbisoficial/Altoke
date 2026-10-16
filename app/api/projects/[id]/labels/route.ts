import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebase/admin";
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

  const existing = await adminDb
    .collection("labels")
    .where("projectId", "==", projectId)
    .where("name", "==", name)
    .limit(1)
    .get();
  if (!existing.empty) return errorResponse(409, "Ya existe una etiqueta con ese nombre en este proyecto");

  const ref = await adminDb.collection("labels").add({ projectId, name, color });
  return NextResponse.json({ label: { id: ref.id, projectId, name, color } }, { status: 201 });
}
