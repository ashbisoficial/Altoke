"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useListSelection } from "@/lib/hooks/useListSelection";

type Status = {
  id: string;
  name: string;
  category: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
  color: string;
  order: number;
  isInitial: boolean;
};

type Transition = { id: string; name: string; fromStatusId: string; toStatusId: string };

const CATEGORY_LABEL: Record<Status["category"], string> = {
  TODO: "Por hacer",
  IN_PROGRESS: "En progreso",
  IN_REVIEW: "En revisión",
  DONE: "Hecho",
};

export function WorkflowEditor({
  workflowId,
  statuses,
  transitions,
  canEdit,
}: {
  workflowId: string;
  statuses: Status[];
  transitions: Transition[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const [statusName, setStatusName] = useState("");
  const [statusCategory, setStatusCategory] = useState<Status["category"]>("TODO");
  const [statusColor, setStatusColor] = useState("#94A3B8");
  const [savingStatus, setSavingStatus] = useState(false);

  const [transitionName, setTransitionName] = useState("");
  const [fromStatusId, setFromStatusId] = useListSelection(statuses);
  const [toStatusId, setToStatusId] = useListSelection(statuses);
  const [savingTransition, setSavingTransition] = useState(false);

  async function addStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!statusName.trim()) return;
    setSavingStatus(true);
    setError(null);
    const res = await fetch(`/api/workflows/${workflowId}/statuses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: statusName.trim(),
        category: statusCategory,
        color: statusColor,
        order: statuses.length,
      }),
    });
    setSavingStatus(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear el estado");
      return;
    }
    setStatusName("");
    router.refresh();
  }

  async function deleteStatus(id: string) {
    setError(null);
    const res = await fetch(`/api/workflows/${workflowId}/statuses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo eliminar el estado");
      return;
    }
    router.refresh();
  }

  async function setInitial(id: string) {
    await fetch(`/api/workflows/${workflowId}/statuses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isInitial: true }),
    });
    router.refresh();
  }

  async function addTransition(e: React.FormEvent) {
    e.preventDefault();
    if (!transitionName.trim() || !fromStatusId || !toStatusId) return;
    setSavingTransition(true);
    setError(null);
    const res = await fetch(`/api/workflows/${workflowId}/transitions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: transitionName.trim(), fromStatusId, toStatusId }),
    });
    setSavingTransition(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear la transición");
      return;
    }
    setTransitionName("");
    router.refresh();
  }

  async function deleteTransition(id: string) {
    await fetch(`/api/workflows/${workflowId}/transitions/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const statusName_ = (id: string) => statuses.find((s) => s.id === id)?.name ?? "?";

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Estados</h2>
        <ul className="flex flex-col gap-2">
          {statuses
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((status) => (
              <li
                key={status.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
              >
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="font-medium">{status.name}</span>
                <span className="text-xs text-ink/50">{CATEGORY_LABEL[status.category]}</span>
                {status.isInitial ? (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    Estado inicial
                  </span>
                ) : (
                  canEdit && (
                    <button
                      type="button"
                      onClick={() => setInitial(status.id)}
                      className="text-xs text-accent underline underline-offset-4"
                    >
                      Hacer inicial
                    </button>
                  )
                )}
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => deleteStatus(status.id)}
                    className="ml-auto text-xs text-ink/40 hover:text-red-600"
                  >
                    Eliminar
                  </button>
                )}
              </li>
            ))}
        </ul>

        {canEdit && (
          <form onSubmit={addStatus} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs font-medium">Nombre</label>
              <Input value={statusName} onChange={(e) => setStatusName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Categoría</label>
              <select
                className="block rounded-md border border-border bg-surface px-2 py-2 text-sm"
                value={statusCategory}
                onChange={(e) => setStatusCategory(e.target.value as Status["category"])}
              >
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Color</label>
              <input
                type="color"
                value={statusColor}
                onChange={(e) => setStatusColor(e.target.value)}
                className="block h-9 w-14 rounded-md border border-border bg-surface"
              />
            </div>
            <Button type="submit" disabled={savingStatus}>
              <Plus size={14} />
              Estado
            </Button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold">Transiciones</h2>
        <ul className="flex flex-col gap-2">
          {transitions.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-ink/60">
                {statusName_(t.fromStatusId)} → {statusName_(t.toStatusId)}
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => deleteTransition(t.id)}
                  className="ml-auto text-xs text-ink/40 hover:text-red-600"
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
          {transitions.length === 0 && (
            <p className="text-sm text-ink/50">No hay transiciones definidas todavía.</p>
          )}
        </ul>

        {canEdit && statuses.length >= 2 && (
          <form onSubmit={addTransition} className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs font-medium">Nombre</label>
              <Input value={transitionName} onChange={(e) => setTransitionName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Desde</label>
              <select
                className="block rounded-md border border-border bg-surface px-2 py-2 text-sm"
                value={fromStatusId}
                onChange={(e) => setFromStatusId(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Hacia</label>
              <select
                className="block rounded-md border border-border bg-surface px-2 py-2 text-sm"
                value={toStatusId}
                onChange={(e) => setToStatusId(e.target.value)}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={savingTransition}>
              <Plus size={14} />
              Transición
            </Button>
          </form>
        )}
      </section>
    </div>
  );
}
