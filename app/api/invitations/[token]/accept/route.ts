import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { syncUserClaims } from "@/lib/firebase/claims";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, notFound, unauthorized } from "@/lib/http";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { token } = await params;

  const invitationRef = adminDb.doc(`invitations/${token}`);
  const snap = await invitationRef.get();
  if (!snap.exists) return notFound("Invitación");
  const invitation = snap.data()!;

  if (invitation.status === "REVOKED") return errorResponse(410, "Esta invitación fue cancelada");
  if (invitation.status === "ACCEPTED") return errorResponse(410, "Esta invitación ya fue usada");
  if (invitation.expiresAt.toDate() < new Date()) return errorResponse(410, "Esta invitación ya expiró");

  await adminDb.runTransaction(async (tx) => {
    const orgMembershipRef = adminDb.doc(`organizations/${invitation.organizationId}/memberships/${user.id}`);
    const orgMembershipSnap = await tx.get(orgMembershipRef);
    if (!orgMembershipSnap.exists) {
      tx.set(orgMembershipRef, { userId: user.id, role: invitation.orgRoleId, createdAt: FieldValue.serverTimestamp() });
    }

    if (invitation.projectId && invitation.projectRoleId) {
      const projectMemberRef = adminDb.doc(`projects/${invitation.projectId}/members/${user.id}`);
      const projectMemberSnap = await tx.get(projectMemberRef);
      if (!projectMemberSnap.exists) {
        tx.set(projectMemberRef, {
          userId: user.id,
          role: invitation.projectRoleId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    tx.update(invitationRef, { status: "ACCEPTED", acceptedAt: FieldValue.serverTimestamp() });
  });
  await syncUserClaims(user.id).catch(() => {});

  return NextResponse.json({
    invitation: { id: token, status: "ACCEPTED" },
    redirectTo: invitation.projectId ? `/board?projectId=${invitation.projectId}` : "/dashboard",
  });
}
