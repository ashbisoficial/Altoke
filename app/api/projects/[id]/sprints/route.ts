import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createSprintSchema = z.object({
  name: z.string().trim().min(1).max(100),
  goal: z.string().trim().max(1000).optional(),
});

function serializeSprint(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    ...data,
    startDate: tsToISO(data.startDate),
    endDate: tsToISO(data.endDate),
    createdAt: tsToISO(data.createdAt),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const snap = await adminDb.collection("sprints").where("projectId", "==", projectId).get();
  const sprints = snap.docs
    .map((d) => serializeSprint(d.id, d.data()))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ sprints });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "sprint.manage"))) return forbidden();

  const parsed = createSprintSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = await adminDb.collection("sprints").add({
    projectId,
    name: parsed.data.name,
    goal: parsed.data.goal ?? null,
    status: "PLANNED",
    startDate: null,
    endDate: null,
    createdAt: FieldValue.serverTimestamp(),
  });
  const created = await ref.get();
  return NextResponse.json({ sprint: serializeSprint(ref.id, created.data()!) }, { status: 201 });
}
