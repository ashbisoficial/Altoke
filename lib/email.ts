/**
 * Thin wrapper over Resend's REST API (no SDK dependency — one endpoint).
 * Replaces Supabase's admin.auth.admin.inviteUserByEmail, which Firebase
 * Auth has no equivalent for. Returns false (never throws) when RESEND_API_KEY
 * isn't configured or the send fails — callers fall back to the shareable
 * link, same as before.
 */
export async function sendInvitationEmail({
  to,
  orgName,
  inviteLink,
}: {
  to: string;
  orgName: string;
  inviteLink: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Altoke <onboarding@resend.dev>",
        to,
        subject: `Te invitaron a ${orgName} en Altoke`,
        html: `<p>Te invitaron a unirte a <strong>${orgName}</strong> en Altoke.</p><p><a href="${inviteLink}">Aceptar invitación</a></p><p>${inviteLink}</p>`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
