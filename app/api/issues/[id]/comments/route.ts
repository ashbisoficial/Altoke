import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";
import { notify } from "@/lib/notifications";

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issueRef = adminDb.doc(`issues/${id}`);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) return notFound("Incidencia");
  const issue = issueSnap.data()!;
  if (!(await isProjectMember(user.id, issue.projectId))) return forbidden();

  const parsed = createCommentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const author = { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl };
  const commentRef = await adminDb.collection("comments").add({
    issueId: id,
    authorId: user.id,
    author,
    body: parsed.data.body,
    createdAt: FieldValue.serverTimestamp(),
  });

  const notifyUserIds = new Set([issue.assigneeId, issue.reporterId].filter((v): v is string => !!v));
  for (const userId of notifyUserIds) {
    await notify({
      userId,
      actorId: user.id,
      type: "ISSUE_COMMENTED",
      title: `Nuevo comentario en ${issue.key}`,
      body: issue.title,
      link: `/issues/${id}`,
    });
  }

  const created = await commentRef.get();
  return NextResponse.json(
    { comment: { id: commentRef.id, ...created.data(), createdAt: tsToISO(created.data()!.createdAt) } },
    { status: 201 },
  );
}
