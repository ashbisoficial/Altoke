"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function CreateProjectForm({
  organizations,
}: {
  organizations: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The org list can go from empty to populated (or change) after this
  // component has already mounted — keep the selection in sync instead of
  // silently submitting the stale initial value.
  useEffect(() => {
    if (organizations.length === 0) return;
    if (!organizations.some((org) => org.id === organizationId)) {
      setOrganizationId(organizations[0].id);
    }
  }, [organizations, organizationId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organizationId, name, key: key.toUpperCase() }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el proyecto");
      return;
    }
    setName("");
    setKey("");
    setOpen(false);
    router.refresh();
  }

  if (organizations.length === 0) return null;

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        + Nuevo proyecto
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <div>
        <label className="text-sm font-medium" htmlFor="project-org">
          Organización
        </label>
        <select
          id="project-org"
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          value={organizationId}
          onChange={(e) => setOrganizationId(e.target.value)}
        >
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="project-name">
          Nombre
        </label>
        <Input id="project-name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="project-key">
          Key (ej. PROJ)
        </label>
        <Input
          id="project-key"
          required
          maxLength={10}
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          className="font-mono uppercase"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creando…" : "Crear"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
