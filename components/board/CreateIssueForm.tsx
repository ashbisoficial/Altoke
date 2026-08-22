"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useListSelection } from "@/lib/hooks/useListSelection";

export function CreateIssueForm({
  projectId,
  issueTypes,
}: {
  projectId: string;
  issueTypes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [issueTypeId, setIssueTypeId] = useListSelection(issueTypes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title, issueTypeId }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la incidencia");
      return;
    }
    setTitle("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <Plus size={14} />
        Nueva incidencia
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="text-xs font-medium" htmlFor="issue-type">
          Tipo
        </label>
        <select
          id="issue-type"
          className="block rounded-md border border-border bg-surface px-2 py-2 text-sm"
          value={issueTypeId}
          onChange={(e) => setIssueTypeId(e.target.value)}
        >
          {issueTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-48 flex-1">
        <label className="text-xs font-medium" htmlFor="issue-title">
          Título
        </label>
        <Input
          id="issue-title"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Creando…" : "Crear"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
