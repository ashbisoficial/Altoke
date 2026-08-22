"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Role = { id: string; name: string };
type Member = {
  id: string;
  user: { id: string; name: string | null; email: string };
  role: Role;
};

export function ProjectMembersManager({
  projectId,
  members,
  roles,
  canManage,
  currentUserId,
}: {
  projectId: string;
  members: Member[];
  roles: Role[];
  canManage: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !roleId) return;
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), roleId }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo añadir al miembro");
      return;
    }
    setEmail("");
    router.refresh();
  }

  async function changeRole(memberId: string, newRoleId: string) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId: newRoleId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo cambiar el rol");
      return;
    }
    router.refresh();
  }

  async function removeMember(memberId: string) {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo quitar al miembro");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
          >
            <span className="font-medium">{member.user.name ?? member.user.email}</span>
            <span className="text-xs text-ink/50">{member.user.email}</span>
            {canManage ? (
              <select
                className="ml-auto rounded-md border border-border bg-surface px-2 py-1 text-sm"
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
                className="text-xs text-ink/40 hover:text-red-600"
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <form onSubmit={addMember} className="flex flex-wrap items-end gap-2">
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
            <label className="text-xs font-medium">Rol</label>
            <select
              className="block rounded-md border border-border bg-surface px-2 py-2 text-sm"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={loading}>
            Añadir
          </Button>
        </form>
      )}
    </div>
  );
}
