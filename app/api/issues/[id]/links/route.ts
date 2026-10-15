import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const LINK_TYPES = [
  "BLOCKS",
  "IS_BLOCKED_BY",
  "RELATES_TO",
  "DUPLICATES",
  "IS_DUPLICATED_BY",
  "CAUSES",
  "IS_CAUSED_BY",
] as const;

const createLinkSchema = z.object({
  targetId: z.string().min(1),
  type: z.enum(LINK_TYPES),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issueSnap = await adminDb.doc(`issues/${id}`).get();
  if (!issueSnap.exists) return notFound("Incidencia");
  const issue = issueSnap.data()!;
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return forbidden();

  const parsed = createLinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { targetId, type } = parsed.data;

  if (targetId === id) return errorResponse(400, "Una incidencia no puede enlazarse a sí misma");

  const targetSnap = await adminDb.doc(`issues/${targetId}`).get();
  if (!targetSnap.exists) return notFound("Incidencia enlazada");
  const target = targetSnap.data()!;
  if (target.projectId !== issue.projectId) {
    return errorResponse(400, "Solo puedes enlazar incidencias del mismo proyecto");
  }

  const existing = await adminDb
    .collection("issueLinks")
    .where("sourceId", "==", id)
    .where("targetId", "==", targetId)
    .where("type", "==", type)
    .limit(1)
    .get();
  if (!existing.empty) return errorResponse(409, "Ese enlace ya existe");

  const ref = await adminDb.collection("issueLinks").add({
    sourceId: id,
    targetId,
    type,
    source: { id, key: issue.key, title: issue.title },
    target: { id: targetId, key: target.key, title: target.title },
    createdAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json(
    { link: { id: ref.id, type, target: { id: targetId, key: target.key, title: target.title } } },
    { status: 201 },
  );
}
