import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

const createTestPlanSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sprintId: z.string().min(1).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const snap = await adminDb.collection("testPlans").where("projectId", "==", projectId).get();
  const testPlans = await Promise.all(
    snap.docs.map(async (d) => {
      const data = d.data();
      const executionCount = await adminDb.collection("testExecutions").where("testPlanId", "==", d.id).count().get();
      return {
        id: d.id,
        name: data.name,
        createdAt: tsToISO(data.createdAt),
        _count: { cases: (data.cases ?? []).length, executions: executionCount.data().count },
      };
    }),
  );
  testPlans.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ testPlans });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "testing.manage"))) return forbidden();

  const parsed = createTestPlanSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const ref = await adminDb.collection("testPlans").add({
    projectId,
    name: parsed.data.name,
    sprintId: parsed.data.sprintId ?? null,
    cases: [],
    createdAt: FieldValue.serverTimestamp(),
  });
  const created = await ref.get();
  const data = created.data()!;
  return NextResponse.json({ testPlan: { id: ref.id, ...data, createdAt: tsToISO(data.createdAt) } }, { status: 201 });
}
