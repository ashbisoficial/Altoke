"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Step = { step: string; expectedResult?: string };

const RUN_STATUS_LABEL: Record<string, string> = {
  NOT_RUN: "Sin ejecutar",
  PASSED: "Aprobado",
  FAILED: "Fallido",
  BLOCKED: "Bloqueado",
};

const RUN_STATUS_COLOR: Record<string, string> = {
  NOT_RUN: "#94A3B8",
  PASSED: "#16A34A",
  FAILED: "#DC2626",
  BLOCKED: "#D97706",
};

export type TestCaseDetailData = {
  id: string;
  preconditions: string | null;
  steps: Step[];
  issue: { id: string; key: string; title: string };
  requirements: { issue: { id: string; key: string; title: string } }[];
  runs: {
    id: string;
    status: keyof typeof RUN_STATUS_LABEL;
    comment: string | null;
    execution: { id: string; name: string; testPlanId: string };
    executedBy: { name: string | null; email: string } | null;
  }[];
};

export function TestCaseDetail({
  testCase,
  otherRequirements,
}: {
  testCase: TestCaseDetailData;
  otherRequirements: { id: string; key: string; title: string }[];
}) {
  const router = useRouter();
  const [preconditions, setPreconditions] = useState(testCase.preconditions ?? "");
  const [steps, setSteps] = useState<Step[]>(
    testCase.steps.length > 0 ? testCase.steps : [{ step: "", expectedResult: "" }],
  );
  const [requirementId, setRequirementId] = useState(otherRequirements[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function updateStep(index: number, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  async function saveSteps() {
    setSaving(true);
    setError(null);
    const cleanSteps = steps.filter((s) => s.step.trim().length > 0);
    const res = await fetch(`/api/test-cases/${testCase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preconditions: preconditions || null, steps: cleanSteps }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    router.refresh();
  }

  async function addRequirement() {
    if (!requirementId) return;
    const res = await fetch(`/api/test-cases/${testCase.id}/requirements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ issueId: requirementId }),
    });
    if (res.ok) router.refresh();
  }

  async function removeRequirement(issueId: string) {
    await fetch(`/api/test-cases/${testCase.id}/requirements/${issueId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href={`/issues/${testCase.issue.id}`} className="text-xs text-accent underline underline-offset-4">
        ← {testCase.issue.key}
      </Link>
      <h1 className="mt-2 font-heading text-2xl font-semibold">{testCase.issue.title}</h1>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Precondiciones</h2>
        <textarea
          value={preconditions}
          onChange={(e) => setPreconditions(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-surface p-3 text-sm"
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Pasos</h2>
        <div className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder={`Paso ${i + 1}`}
                value={s.step}
                onChange={(e) => updateStep(i, "step", e.target.value)}
                className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
              <input
                placeholder="Resultado esperado"
                value={s.expectedResult ?? ""}
                onChange={(e) => updateStep(i, "expectedResult", e.target.value)}
                className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setSteps((prev) => prev.filter((_, idx) => idx !== i))}
                className="shrink-0 text-xs text-ink/40 hover:text-red-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setSteps((prev) => [...prev, { step: "", expectedResult: "" }])}
            className="text-xs text-accent underline underline-offset-4"
          >
            + Añadir paso
          </button>
        </div>
        <Button onClick={saveSteps} disabled={saving} className="mt-3">
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Requisitos que cubre</h2>
        {testCase.requirements.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1">
            {testCase.requirements.map((r) => (
              <li
                key={r.issue.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs text-accent">{r.issue.key}</span>
                <span className="flex-1 truncate">{r.issue.title}</span>
                <button
                  type="button"
                  onClick={() => removeRequirement(r.issue.id)}
                  className="text-xs text-ink/40 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {otherRequirements.length > 0 && (
          <div className="flex gap-2">
            <select
              className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              value={requirementId}
              onChange={(e) => setRequirementId(e.target.value)}
            >
              {otherRequirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.key} — {r.title}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={addRequirement}>
              Enlazar
            </Button>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Historial de ejecuciones</h2>
        {testCase.runs.length === 0 ? (
          <p className="text-sm text-ink/50">Todavía no se ha ejecutado en ningún plan.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {testCase.runs.map((run) => (
              <li
                key={run.id}
                className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: RUN_STATUS_COLOR[run.status] }}
                />
                <Link href={`/test-plans/${run.execution.testPlanId}`} className="text-accent hover:underline">
                  {run.execution.name}
                </Link>
                <span className="text-ink/60">{RUN_STATUS_LABEL[run.status]}</span>
                {run.executedBy && (
                  <span className="ml-auto text-xs text-ink/50">
                    {run.executedBy.name ?? run.executedBy.email}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
