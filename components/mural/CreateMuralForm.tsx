"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function CreateMuralForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/boards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "MURAL" }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el mural");
      return;
    }
    const { board } = await res.json();
    router.push(`/mural/${board.id}`);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <Plus size={14} />
        Nuevo mural
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre del mural (ej. Sprint 12)"
      />
      <Button type="submit" disabled={loading}>
        Crear
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
