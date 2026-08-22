import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { AcceptInvitation } from "@/components/invitations/AcceptInvitation";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      project: { select: { name: true } },
      orgRole: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
  if (!invitation) notFound();

  const user = await getSessionUser();

  const isExpired = invitation.expiresAt < new Date();
  const inviterName = invitation.invitedBy.name ?? invitation.invitedBy.email;

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="font-heading text-xl font-semibold">Altoke</h1>

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
              <strong>{invitation.organization.name}</strong>
              {invitation.project && (
                <>
                  {" "}
                  y al proyecto <strong>{invitation.project.name}</strong>
                </>
              )}
              .
            </p>
            <p className="mt-1 text-xs text-ink/50">Rol: {invitation.orgRole.name}</p>
            <div className="mt-6">
              <AcceptInvitation token={token} isLoggedIn={!!user} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
