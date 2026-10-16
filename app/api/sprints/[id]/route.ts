import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";

const updateSprintSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  goal: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`sprints/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Sprint");
  if (!(await hasProjectPermission(user.id, snap.data()!.projectId, "sprint.manage"))) return forbidden();

  const parsed = updateSprintSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { startDate, endDate, ...rest } = parsed.data;

  await ref.update({
    ...rest,
    ...(startDate !== undefined ? { startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null } : {}),
    ...(endDate !== undefined ? { endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null } : {}),
  });

  const updated = await ref.get();
  const data = updated.data()!;
  return NextResponse.json({
    sprint: { id, ...data, startDate: tsToISO(data.startDate), endDate: tsToISO(data.endDate), createdAt: tsToISO(data.createdAt) },
  });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const ref = adminDb.doc(`sprints/${id}`);
  const snap = await ref.get();
  if (!snap.exists) return notFound("Sprint");
  if (!(await hasProjectPermission(user.id, snap.data()!.projectId, "sprint.manage"))) return forbidden();

  await ref.delete();
  return NextResponse.json({ ok: true });
}
