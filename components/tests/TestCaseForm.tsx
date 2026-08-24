"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Step = { step: string; expectedResult: string };

export function TestCaseForm({
  projectId,
  requirements,
}: {
  projectId: string;
  requirements: { id: string; key: string; title: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [preconditions, setPreconditions] = useState("");
  const [steps, setSteps] = useState<Step[]>([{ step: "", expectedResult: "" }]);
  const [requirementIds, setRequirementIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateStep(index: number, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function toggleRequirement(id: string) {
    setRequirementIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const cleanSteps = steps.filter((s) => s.step.trim().length > 0);
    const res = await fetch(`/api/projects/${projectId}/test-cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        preconditions: preconditions || undefined,
        steps: cleanSteps,
        requirementIds,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear el caso de prueba");
      return;
    }
    setTitle("");
    setPreconditions("");
    setSteps([{ step: "", expectedResult: "" }]);
    setRequirementIds([]);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="shrink-0">
        <Plus size={14} />
        Caso de prueba
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shadow-soft flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <div>
        <label className="text-sm font-medium" htmlFor="tc-title">
          Título
        </label>
        <Input id="tc-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="tc-precond">
          Precondiciones
        </label>
        <textarea
          id="tc-precond"
          value={preconditions}
          onChange={(e) => setPreconditions(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-surface p-2 text-sm"
        />
      </div>

      <div>
        <span className="text-sm font-medium">Pasos</span>
        <div className="mt-1 flex flex-col gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder={`Paso ${i + 1}`}
                value={s.step}
                onChange={(e) => updateStep(i, "step", e.target.value)}
              />
              <Input
                placeholder="Resultado esperado"
                value={s.expectedResult}
                onChange={(e) => updateStep(i, "expectedResult", e.target.value)}
              />
              <button
                type="button"
                onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label="Quitar paso"
                className="shrink-0 text-ink/40 hover:text-red-600"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSteps((prev) => [...prev, { step: "", expectedResult: "" }])}
          className="mt-1 flex items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
        >
          <Plus size={12} />
          Añadir paso
        </button>
      </div>

      {requirements.length > 0 && (
        <div>
          <span className="text-sm font-medium">Requisitos que cubre</span>
          <div className="mt-1 flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
            {requirements.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={requirementIds.includes(r.id)}
                  onChange={() => toggleRequirement(r.id)}
                />
                <span className="font-mono text-xs text-accent">{r.key}</span>
                <span className="truncate">{r.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

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
