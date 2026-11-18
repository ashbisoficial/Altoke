"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useListSelection } from "@/lib/hooks/useListSelection";
import { ISSUE_TYPE_HELP } from "@/lib/issue-type-help";
import { CustomFieldInput, type FieldDef, type PersonOption } from "@/components/fields/CustomFieldInput";

/** Quita los valores vacíos para no enviar campos sin contenido. */
function compactValues(defs: FieldDef[], values: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const def of defs) {
    const v = values[def.id];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
    out[def.id] = v;
  }
  return out;
}

export function CreateIssueForm({
  projectId,
  issueTypes,
  customFields = [],
  people = [],
}: {
  projectId: string;
  issueTypes: { id: string; name: string }[];
  customFields?: FieldDef[];
  people?: PersonOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [issueTypeId, setIssueTypeId] = useListSelection(issueTypes);
  const selectedType = issueTypes.find((t) => t.id === issueTypeId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, title, issueTypeId, customFields: compactValues(customFields, customValues) }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.fields ? Object.values(body.fields).flat().join(" ") : null;
      setError(detail ?? body.error ?? "No se pudo crear la incidencia");
      return;
    }
    setTitle("");
    setCustomValues({});
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="shrink-0" data-testid="board-create-open-button">
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
          id="issue-type" data-testid="board-create-type-select"
          className="block rounded-lg border border-border bg-surface px-2 py-2 text-sm"
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
          id="issue-title" data-testid="board-create-title-input"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      {customFields.map((def) => (
        <label key={def.id} className="flex min-w-40 flex-col gap-1 text-xs">
          <span className="font-medium">
            {def.name}
            {def.required && <span className="text-red-600"> *</span>}
          </span>
          <CustomFieldInput
            def={def}
            value={customValues[def.id]}
            people={people}
            testId={`board-create-field-${def.name.toLowerCase().replace(/\s+/g, "-")}`}
            onChange={(v) => setCustomValues((prev) => ({ ...prev, [def.id]: v }))}
          />
        </label>
      ))}
      <Button type="submit" disabled={loading} data-testid="board-create-submit-button">
        {loading ? "Creando…" : "Crear"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)} data-testid="board-create-cancel-button">
        Cancelar
      </Button>
      {selectedType && ISSUE_TYPE_HELP[selectedType.name] && (
        <p className="w-full text-xs text-ink/50">{ISSUE_TYPE_HELP[selectedType.name]}</p>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
