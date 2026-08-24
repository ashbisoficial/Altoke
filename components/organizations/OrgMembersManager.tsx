"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useListSelection } from "@/lib/hooks/useListSelection";

type Role = { id: string; name: string };
type Member = { id: string; user: { id: string; name: string | null; email: string }; role: Role };
type ProjectOption = { id: string; name: string };
type Invitation = {
  id: string;
  token: string;
  email: string;
  status: string;
  emailSent: boolean;
  orgRole: { name: string };
  project: { id: string; name: string } | null;
  invitedBy: { name: string | null; email: string };
};

export function OrgMembersManager({
  organizationId,
  members,
  invitations,
  roles,
  projects,
  canManage,
  currentUserId,
  siteUrl,
}: {
  organizationId: string;
  members: Member[];
  invitations: Invitation[];
  roles: Role[];
  projects: ProjectOption[];
  canManage: boolean;
  currentUserId: string;
  siteUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [orgRoleId, setOrgRoleId] = useListSelection(roles);
  const [alsoProject, setAlsoProject] = useState(false);
  const [projectId, setProjectId] = useListSelection(projects);
  const [projectRoleId, setProjectRoleId] = useListSelection(roles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<{ link: string; emailed: boolean } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !orgRoleId) return;
    setLoading(true);
    setError(null);
    setLastLink(null);
    const res = await fetch(`/api/organizations/${organizationId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        orgRoleId,
        ...(alsoProject && projectId ? { projectId, projectRoleId } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo enviar la invitación");
      return;
    }
    const data = await res.json();
    setLastLink({ link: data.inviteLink, emailed: data.emailed });
    setEmail("");
    setAlsoProject(false);
    router.refresh();
  }

  async function copyLink(link: string, id: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000);
    } catch {
      // clipboard API unavailable — the link is still selectable text.
    }
  }

  async function revokeInvitation(id: string) {
    await fetch(`/api/organizations/${organizationId}/invitations/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function changeRole(memberId: string, roleId: string) {
    await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    router.refresh();
  }

  async function removeMember(memberId: string) {
    setError(null);
    const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo quitar al miembro");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-2 font-heading text-lg font-semibold">Miembros</h2>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span className="font-medium">{member.user.name ?? member.user.email}</span>
              <span className="text-xs text-ink/50">{member.user.email}</span>
              {canManage ? (
                <select
                  className="ml-auto rounded-lg border border-border bg-surface px-2 py-1 text-sm"
                  value={member.role.id}
                  onChange={(e) => changeRole(member.id, e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="ml-auto text-xs text-ink/60">{member.role.name}</span>
              )}
              {canManage && member.user.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => removeMember(member.id)}
                  aria-label="Quitar miembro"
                  className="text-ink/40 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {canManage && (
        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Invitar a alguien</h2>
          <form onSubmit={invite} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-48 flex-1">
                <label className="text-xs font-medium">Correo</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="persona@correo.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Rol en la organización</label>
                <select
                  className="block rounded-lg border border-border bg-surface px-2 py-2 text-sm"
                  value={orgRoleId}
                  onChange={(e) => setOrgRoleId(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {projects.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={alsoProject}
                  onChange={(e) => setAlsoProject(e.target.checked)}
                />
                Añadir directamente a un proyecto
              </label>
            )}

            {alsoProject && (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="text-xs font-medium">Proyecto</label>
                  <select
                    className="block rounded-lg border border-border bg-surface px-2 py-2 text-sm"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium">Rol en el proyecto</label>
                  <select
                    className="block rounded-lg border border-border bg-surface px-2 py-2 text-sm"
                    value={projectRoleId}
                    onChange={(e) => setProjectRoleId(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-fit">
              <Mail size={14} />
              {loading ? "Enviando…" : "Invitar"}
            </Button>
          </form>

          {lastLink && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
              <p className="text-ink/70">
                {lastLink.emailed
                  ? "Se mandó un correo de invitación. También puedes compartir este enlace:"
                  : "No se pudo mandar el correo automático (puede ser un límite del plan gratuito) — comparte este enlace manualmente:"}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto rounded bg-bg px-2 py-1 text-xs">{lastLink.link}</code>
                <Button variant="secondary" onClick={() => copyLink(lastLink.link, "last")}>
                  <Copy size={14} />
                  {copiedId === "last" ? "¡Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {canManage && invitations.length > 0 && (
        <section>
          <h2 className="mb-2 font-heading text-lg font-semibold">Invitaciones pendientes</h2>
          <ul className="flex flex-col gap-2">
            {invitations.map((inv) => {
              const link = `${siteUrl}/invite/${inv.token}`;
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="font-medium">{inv.email}</span>
                  <span className="text-xs text-ink/50">
                    {inv.orgRole.name}
                    {inv.project && ` · ${inv.project.name}`}
                  </span>
                  {!inv.emailSent && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                      Sin correo enviado
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => copyLink(link, inv.id)}
                    className="text-xs text-accent hover:underline"
                  >
                    {copiedId === inv.id ? "¡Copiado!" : "Copiar enlace"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revokeInvitation(inv.id)}
                    className="text-xs text-ink/40 hover:text-red-600"
                  >
                    Cancelar
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
