import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { syncUserClaims } from "@/lib/firebase/claims";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";

const addMemberSchema = z.object({
  email: z.string().trim().email(),
  roleId: z.enum(Object.keys(DEFAULT_ROLES) as [string, ...string[]]),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "member.manage"))) return forbidden();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) return notFound("Proyecto");
  const project = projectSnap.data()!;

  const parsed = addMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { email, roleId: role } = parsed.data;

  const targetSnap = await adminDb.collection("users").where("email", "==", email).limit(1).get();
  if (targetSnap.empty) {
    return errorResponse(404, "Ese correo todavía no tiene una cuenta en Altoke.");
  }
  const targetUserId = targetSnap.docs[0].id;
  const targetUser = targetSnap.docs[0].data();

  const orgMembership = await adminDb.doc(`organizations/${project.organizationId}/memberships/${targetUserId}`).get();
  if (!orgMembership.exists) {
    return errorResponse(
      409,
      "Ese usuario todavía no pertenece a la organización. Agrégalo desde la organización primero.",
    );
  }

  const memberRef = adminDb.doc(`projects/${projectId}/members/${targetUserId}`);
  const existing = await memberRef.get();
  if (existing.exists) return errorResponse(409, "Ese usuario ya es miembro del proyecto");

  await memberRef.set({ userId: targetUserId, role, createdAt: FieldValue.serverTimestamp() });
  await syncUserClaims(targetUserId).catch((e) => console.error("syncUserClaims failed", e));

  await notify({
    userId: targetUserId,
    actorId: user.id,
    type: "PROJECT_MEMBER_ADDED",
    title: `Te añadieron al proyecto ${project.name}`,
    link: `/board?projectId=${projectId}`,
  });

  return NextResponse.json(
    {
      member: {
        id: targetUserId,
        role: { id: role, name: role },
        user: {
          id: targetUserId,
          name: targetUser.name ?? null,
          email: targetUser.email,
          avatarUrl: targetUser.avatarUrl ?? null,
        },
      },
    },
    { status: 201 },
  );
}
