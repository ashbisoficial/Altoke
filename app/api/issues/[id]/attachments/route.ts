import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";

/**
 * The file itself is uploaded directly from the browser to Storage (see
 * lib/firebase/storage.ts, migrated in a later phase) — this route only
 * persists the resulting metadata, keeping large payloads off our server.
 */
const createAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().url(),
  fileSize: z.number().int().min(0),
  mimeType: z.string().trim().min(1).max(127),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issueSnap = await adminDb.doc(`issues/${id}`).get();
  if (!issueSnap.exists) return notFound("Incidencia");
  if (!(await isProjectMember(user.id, issueSnap.data()!.projectId))) return forbidden();

  const parsed = createAttachmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = await adminDb.collection("attachments").add({
    issueId: id,
    uploaderId: user.id,
    ...parsed.data,
    createdAt: FieldValue.serverTimestamp(),
  });
  const created = await ref.get();
  return NextResponse.json(
    { attachment: { id: ref.id, ...created.data(), createdAt: tsToISO(created.data()!.createdAt) } },
    { status: 201 },
  );
}
