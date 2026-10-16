import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { notFound } from "@/lib/http";

/** Public lookup used by the /invite/[token] page — no auth required to preview. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const snap = await adminDb.doc(`invitations/${token}`).get();
  if (!snap.exists) return notFound("Invitación");
  const data = snap.data()!;

  const [orgSnap, projectSnap, inviterSnap] = await Promise.all([
    adminDb.doc(`organizations/${data.organizationId}`).get(),
    data.projectId ? adminDb.doc(`projects/${data.projectId}`).get() : Promise.resolve(null),
    adminDb.doc(`users/${data.invitedById}`).get(),
  ]);

  const invitation = {
    id: snap.id,
    token: snap.id,
    email: data.email,
    status: data.status,
    expiresAt: tsToISO(data.expiresAt),
    organization: { name: orgSnap.exists ? orgSnap.data()!.name : "" },
    project: projectSnap?.exists ? { name: projectSnap.data()!.name } : null,
    orgRole: { name: data.orgRoleId },
    projectRole: data.projectRoleId ? { name: data.projectRoleId } : null,
    invitedBy: {
      name: inviterSnap.exists ? (inviterSnap.data()!.name ?? null) : null,
      email: inviterSnap.exists ? inviterSnap.data()!.email : "",
    },
  };

  return NextResponse.json({ invitation });
}
