import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(["KANBAN", "SCRUM", "MURAL"]).default("MURAL"),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const type = request.nextUrl.searchParams.get("type");
  let query = adminDb.collection("boards").where("projectId", "==", projectId) as FirebaseFirestore.Query;
  if (type) query = query.where("type", "==", type);

  const snap = await query.get();
  const boards = await Promise.all(
    snap.docs.map(async (d) => {
      const count = await adminDb.collection(`boards/${d.id}/elements`).count().get();
      const data = d.data();
      return { id: d.id, ...data, createdAt: tsToISO(data.createdAt), _count: { muralElements: count.data().count } };
    }),
  );
  boards.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ boards });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "mural.edit"))) return forbidden();

  const parsed = createBoardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = await adminDb.collection("boards").add({
    projectId,
    name: parsed.data.name,
    type: parsed.data.type,
    createdAt: FieldValue.serverTimestamp(),
  });
  const created = await ref.get();
  const data = created.data()!;
  return NextResponse.json({ board: { id: ref.id, ...data, createdAt: tsToISO(data.createdAt) } }, { status: 201 });
}
