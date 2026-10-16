import { notFound } from "next/navigation";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { AcceptInvitation } from "@/components/invitations/AcceptInvitation";
import { Logo } from "@/components/layout/Logo";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const snap = await adminDb.doc(`invitations/${token}`).get();
  if (!snap.exists) notFound();
  const invitation = snap.data()!;

  const [orgSnap, projectSnap, inviterSnap, user] = await Promise.all([
    adminDb.doc(`organizations/${invitation.organizationId}`).get(),
    invitation.projectId ? adminDb.doc(`projects/${invitation.projectId}`).get() : Promise.resolve(null),
    adminDb.doc(`users/${invitation.invitedById}`).get(),
    getSessionUser(),
  ]);

  const isExpired = invitation.expiresAt.toDate() < new Date();
  const inviter = inviterSnap.data();
  const inviterName = inviter?.name ?? inviter?.email ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="shadow-soft w-full max-w-sm rounded-xl border border-border bg-surface p-8 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>

        {invitation.status === "REVOKED" ? (
          <p className="mt-4 text-sm text-ink/70">Esta invitación fue cancelada por quien la envió.</p>
        ) : invitation.status === "ACCEPTED" ? (
          <p className="mt-4 text-sm text-ink/70">Esta invitación ya fue usada. Inicia sesión normalmente.</p>
        ) : isExpired ? (
          <p className="mt-4 text-sm text-ink/70">
            Esta invitación ya expiró. Pídele a {inviterName} que te mande una nueva.
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-ink/70">
              <strong>{inviterName}</strong> te invitó a unirte a{" "}
              <strong>{orgSnap.exists ? orgSnap.data()!.name : ""}</strong>
              {projectSnap?.exists && (
                <>
                  {" "}
                  y al proyecto <strong>{projectSnap.data()!.name}</strong>
                </>
              )}
              .
            </p>
            <p className="mt-1 text-xs text-ink/50">Rol: {invitation.orgRoleId}</p>
            <div className="mt-6">
              <AcceptInvitation token={token} isLoggedIn={!!user} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
