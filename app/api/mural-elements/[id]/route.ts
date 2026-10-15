import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateElementSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().min(1).optional(),
  height: z.number().min(1).optional(),
  rotation: z.number().optional(),
  color: z.string().max(50).nullable().optional(),
  zIndex: z.number().int().optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

async function loadWithProject(id: string) {
  const snap = await adminDb.doc(`muralElements/${id}`).get();
  if (!snap.exists) return null;
  const data = snap.data()!;
  const boardSnap = await adminDb.doc(`boards/${data.boardId}`).get();
  return { snap, data, projectId: boardSnap.data()?.projectId as string | undefined };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const found = await loadWithProject(id);
  if (!found || !found.projectId) return notFound("Elemento del mural");
  if (!(await hasProjectPermission(user.id, found.projectId, "mural.edit"))) return forbidden();

  const parsed = updateElementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = adminDb.doc(`muralElements/${id}`);
  await ref.update({ ...parsed.data, updatedAt: FieldValue.serverTimestamp() });
  const updated = await ref.get();
  return NextResponse.json({ element: { id, ...updated.data() } });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const found = await loadWithProject(id);
  if (!found || !found.projectId) return notFound("Elemento del mural");
  if (!(await hasProjectPermission(user.id, found.projectId, "mural.edit"))) return forbidden();

  await adminDb.doc(`muralElements/${id}`).delete();
  return NextResponse.json({ ok: true });
}
