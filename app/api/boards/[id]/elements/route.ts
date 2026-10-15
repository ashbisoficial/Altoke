import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createElementSchema = z.object({
  type: z.enum(["STICKY_NOTE", "TEXT", "FRAME", "IMAGE", "DRAWING"]),
  x: z.number(),
  y: z.number(),
  width: z.number().min(1),
  height: z.number().min(1),
  rotation: z.number().optional(),
  color: z.string().max(50).optional(),
  zIndex: z.number().int().optional(),
  content: z.record(z.string(), z.unknown()),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: boardId } = await params;

  const boardSnap = await adminDb.doc(`boards/${boardId}`).get();
  if (!boardSnap.exists) return notFound("Mural");
  if (!(await isProjectMember(user.id, boardSnap.data()!.projectId))) return forbidden();

  const snap = await adminDb.collection("muralElements").where("boardId", "==", boardId).get();
  const elements = snap.docs
    .map((d) => ({ id: d.id, zIndex: d.data().zIndex as number, ...d.data() }))
    .sort((a, b) => a.zIndex - b.zIndex);

  return NextResponse.json({ elements });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: boardId } = await params;

  const boardSnap = await adminDb.doc(`boards/${boardId}`).get();
  if (!boardSnap.exists) return notFound("Mural");
  if (!(await hasProjectPermission(user.id, boardSnap.data()!.projectId, "mural.edit"))) return forbidden();

  const parsed = createElementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = await adminDb.collection("muralElements").add({
    boardId,
    createdById: user.id,
    rotation: 0,
    color: null,
    zIndex: 0,
    ...parsed.data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  const created = await ref.get();
  return NextResponse.json({ element: { id: ref.id, ...created.data() } }, { status: 201 });
}
