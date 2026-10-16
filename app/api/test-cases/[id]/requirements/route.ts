import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const addRequirementSchema = z.object({
  issueId: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`testCases/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Caso de prueba");
  const testCase = snap.data()!;
  if (!(await hasProjectPermission(user.id, testCase.projectId, "testing.manage"))) return forbidden();

  const parsed = addRequirementSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const reqSnap = await adminDb.doc(`issues/${parsed.data.issueId}`).get();
  if (!reqSnap.exists || reqSnap.data()!.projectId !== testCase.projectId) {
    return errorResponse(400, "El requisito debe pertenecer al mismo proyecto");
  }
  const reqData = reqSnap.data()!;

  const entry = { issue: { id: reqSnap.id, key: reqData.key, title: reqData.title } };
  const already = ((testCase.requirements ?? []) as { issue: { id: string } }[]).some(
    (r) => r.issue.id === reqSnap.id,
  );
  if (!already) {
    await ref.update({ requirements: FieldValue.arrayUnion(entry) });
  }

  return NextResponse.json({ link: entry }, { status: 201 });
}
