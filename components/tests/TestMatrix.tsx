"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useListSelection } from "@/lib/hooks/useListSelection";

type RunStatus = "NOT_RUN" | "PASSED" | "FAILED" | "BLOCKED";

const STATUS_LABEL: Record<RunStatus, string> = {
  NOT_RUN: "Sin ejecutar",
  PASSED: "Aprobado",
  FAILED: "Fallido",
  BLOCKED: "Bloqueado",
};

const STATUS_COLOR: Record<RunStatus, string> = {
  NOT_RUN: "#94A3B8",
  PASSED: "#16A34A",
  FAILED: "#DC2626",
  BLOCKED: "#D97706",
};

type Run = { id: string; status: RunStatus; comment: string | null; testCaseId: string };
type Execution = { id: string; name: string; runs: Run[] };
type Row = { testCase: { id: string; issue: { id: string; key: string; title: string } } };

export function TestMatrix({
  testPlanId,
  rows,
  executions,
  availableCases,
}: {
  testPlanId: string;
  rows: Row[];
  executions: Execution[];
  availableCases: { id: string; issue: { key: string; title: string } }[];
}) {
  const router = useRouter();
  const [activeRun, setActiveRun] = useState<Run | null>(null);
  const [status, setStatus] = useState<RunStatus>("NOT_RUN");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newExecutionName, setNewExecutionName] = useState("");
  const [creatingExecution, setCreatingExecution] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useListSelection(availableCases);

  function openRun(run: Run) {
    setActiveRun(run);
    setStatus(run.status);
    setComment(run.comment ?? "");
    setError(null);
  }

  async function saveRun() {
    if (!activeRun) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/test-runs/${activeRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment: comment || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar");
      return;
    }
    setActiveRun(null);
    router.refresh();
  }

  async function createExecution(e: React.FormEvent) {
    e.preventDefault();
    if (!newExecutionName.trim()) return;
    setCreatingExecution(true);
    setError(null);
    const res = await fetch(`/api/test-plans/${testPlanId}/executions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newExecutionName.trim() }),
    });
    setCreatingExecution(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo crear la ejecución");
      return;
    }
    setNewExecutionName("");
    router.refresh();
  }

  async function addCase() {
    if (!selectedCaseId) return;
    const res = await fetch(`/api/test-plans/${testPlanId}/cases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testCaseId: selectedCaseId }),
    });
    if (res.ok) router.refresh();
  }

  async function removeCase(testCaseId: string) {
    await fetch(`/api/test-plans/${testPlanId}/cases/${testCaseId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-4">
        <form onSubmit={createExecution} className="flex gap-2">
          <Input
            value={newExecutionName}
            onChange={(e) => setNewExecutionName(e.target.value)}
            placeholder="Nombre de la ejecución"
          />
          <Button type="submit" disabled={creatingExecution || rows.length === 0}>
            <Plus size={14} />
            Ejecución
          </Button>
        </form>
        {availableCases.length > 0 && (
          <div className="flex gap-2">
            <select
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
            >
              {availableCases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.issue.key} — {c.issue.title}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={addCase}>
              <Plus size={14} />
              Caso al plan
            </Button>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink/60">Añade casos de prueba al plan para empezar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-border px-2 py-2 text-left font-medium">Caso de prueba</th>
                {executions.map((exec) => (
                  <th key={exec.id} className="border-b border-border px-2 py-2 text-center font-medium">
                    {exec.name}
                  </th>
                ))}
                <th className="border-b border-border px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.testCase.id}>
                  <td className="border-b border-border px-2 py-2">
                    <Link href={`/tests/${row.testCase.id}`} className="hover:underline">
                      <span className="font-mono text-xs text-accent">{row.testCase.issue.key}</span>{" "}
                      <span>{row.testCase.issue.title}</span>
                    </Link>
                  </td>
                  {executions.map((exec) => {
                    const run = exec.runs.find((r) => r.testCaseId === row.testCase.id);
                    return (
                      <td key={exec.id} className="border-b border-border px-2 py-2 text-center">
                        {run ? (
                          <button
                            type="button"
                            onClick={() => openRun(run)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: STATUS_COLOR[run.status] }}
                            title={STATUS_LABEL[run.status]}
                            aria-label={`${row.testCase.issue.key} en ${exec.name}: ${STATUS_LABEL[run.status]}`}
                          />
                        ) : (
                          <span className="text-ink/30">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border-b border-border px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeCase(row.testCase.id)}
                      className="text-xs text-ink/40 hover:text-red-600"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeRun && (
        <div className="mt-4 flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold">Actualizar resultado</h3>
          <select
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as RunStatus)}
          >
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Comentario / evidencia (opcional)"
            className="w-full rounded-md border border-border bg-surface p-2 text-sm"
          />
          <div className="flex gap-2">
            <Button onClick={saveRun} disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
            <Button variant="ghost" onClick={() => setActiveRun(null)}>
              Cerrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
