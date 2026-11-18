"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Saved = { id: string; name: string; shared: boolean; ownerId: string; href: string };

/** Filtros guardados: se guardan con la URL actual, y se comparten con el proyecto (F1-3). */
export function SavedFilters({
  projectId,
  currentQuery,
  currentUserId,
  filters,
}: {
  projectId: string;
  currentQuery: string;
  currentUserId: string;
  filters: Saved[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [shared, setShared] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/saved-filters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), query: currentQuery, shared }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar el filtro");
      return;
    }
    setName("");
    router.refresh();
  }

  async function remove(id: string) {
    setError(null);
    const res = await fetch(`/api/saved-filters/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("No se pudo borrar el filtro");
      return;
    }
    router.refresh();
  }

  return (
    <aside className="shadow-soft flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 text-sm" data-testid="saved-filters">
      <section>
        <h2 className="mb-2 text-xs font-semibold text-ink/70">Filtros guardados</h2>
        {filters.length === 0 ? (
          <p className="text-xs text-ink/50">Todavía no hay filtros guardados.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filters.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <Link href={f.href} className="flex-1 truncate text-accent hover:underline" data-testid={`saved-filter-${f.id}`}>
                  {f.name}
                </Link>
                {!f.shared && <span className="text-[10px] text-ink/40">privado</span>}
                {f.ownerId === currentUserId && (
                  <button type="button" onClick={() => remove(f.id)} aria-label={`Borrar ${f.name}`} className="text-ink/40 hover:text-red-600" data-testid={`saved-filter-delete-${f.id}`}>
                    <Trash2 size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={save} className="flex flex-col gap-2 border-t border-border pt-3">
        <h2 className="text-xs font-semibold text-ink/70">Guardar el filtro actual</h2>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del filtro" maxLength={80} required data-testid="saved-filter-name-input" />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} data-testid="saved-filter-shared-checkbox" />
          Compartido con el proyecto
        </label>
        <Button type="submit" variant="secondary" disabled={!name.trim()} data-testid="saved-filter-save-button">
          Guardar
        </Button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>
    </aside>
  );
}
