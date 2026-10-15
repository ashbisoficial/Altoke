import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const attachLabelSchema = z.object({ labelId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issueRef = adminDb.doc(`issues/${id}`);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) return notFound("Incidencia");
  const issue = issueSnap.data()!;
  if (!(await hasProjectPermission(user.id, issue.projectId, "issue.edit"))) return forbidden();

  const parsed = attachLabelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { labelId } = parsed.data;

  const labelSnap = await adminDb.doc(`labels/${labelId}`).get();
  if (!labelSnap.exists) return notFound("Etiqueta");
  const label = labelSnap.data()!;
  if (label.projectId !== issue.projectId) {
    return errorResponse(400, "La etiqueta no pertenece a este proyecto");
  }

  const entry = { label: { id: labelId, name: label.name, color: label.color } };
  const already = ((issue.labels ?? []) as { label: { id: string } }[]).some((l) => l.label.id === labelId);
  if (!already) {
    await issueRef.update({ labels: FieldValue.arrayUnion(entry), updatedAt: FieldValue.serverTimestamp() });
  }

  return NextResponse.json({ issueLabel: entry }, { status: 201 });
}
