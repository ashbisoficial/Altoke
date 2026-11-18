"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export type FieldRow = {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "MULTI_SELECT" | "USER";
  options: string[] | null;
  required: boolean;
  position: number;
};

const TYPE_LABEL: Record<FieldRow["type"], string> = {
  TEXT: "Texto",
  NUMBER: "Número",
  DATE: "Fecha",
  SELECT: "Selección",
  MULTI_SELECT: "Selección múltiple",
  USER: "Persona",
};

/** Alta, orden, obligatoriedad y borrado de campos personalizados (F1-2). */
export function CustomFieldsManager({ projectId, initialFields }: { projectId: string; initialFields: FieldRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldRow["type"]>("TEXT");
  const [options, setOptions] = useState("");
  const [required, setRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsOptions = type === "SELECT" || type === "MULTI_SELECT";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      name: name.trim(),
      type,
      required,
      ...(needsOptions
        ? { options: options.split(",").map((o) => o.trim()).filter(Boolean) }
        : {}),
    };
    const res = await fetch(`/api/projects/${projectId}/custom-fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo crear el campo");
      return;
    }
    setName("");
    setOptions("");
    setRequired(false);
    router.refresh();
  }

  async function patch(id: string, data: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/custom-fields/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar");
      return;
    }
    router.refresh();
  }

  async function remove(field: FieldRow) {
    if (!window.confirm(`¿Borrar el campo "${field.name}"? Se quita de todas las incidencias del proyecto.`)) return;
    setError(null);
    const res = await fetch(`/api/custom-fields/${field.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo borrar el campo");
      return;
    }
    router.refresh();
  }

  /** Intercambia la posición con el campo vecino. */
  async function move(index: number, delta: -1 | 1) {
    const other = initialFields[index + delta];
    if (!other) return;
    const field = initialFields[index];
    await patch(field.id, { position: other.position });
    await patch(other.id, { position: field.position });
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Campos del proyecto</h2>
        {initialFields.length === 0 ? (
          <p className="text-sm text-ink/50">Todavía no hay campos personalizados.</p>
        ) : (
          <ul className="flex flex-col gap-1.5" data-testid="custom-fields-list">
            {initialFields.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <span className="font-medium">{f.name}</span>
                <span className="text-xs text-ink/50">{TYPE_LABEL[f.type]}</span>
                {f.options && <span className="text-xs text-ink/40">({f.options.join(", ")})</span>}
                <label className="ml-auto flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => patch(f.id, { required: e.target.checked })}
                    data-testid={`custom-field-required-${f.id}`}
                  />
                  Obligatorio
                </label>
                <Button variant="ghost" aria-label={`Subir ${f.name}`} disabled={i === 0} onClick={() => move(i, -1)} data-testid={`custom-field-up-${f.id}`}>
                  <ArrowUp size={14} />
                </Button>
                <Button variant="ghost" aria-label={`Bajar ${f.name}`} disabled={i === initialFields.length - 1} onClick={() => move(i, 1)} data-testid={`custom-field-down-${f.id}`}>
                  <ArrowDown size={14} />
                </Button>
                <Button variant="ghost" aria-label={`Borrar ${f.name}`} onClick={() => remove(f)} data-testid={`custom-field-delete-${f.id}`}>
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-ink/70">Nuevo campo</h2>
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs">
            Nombre
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} data-testid="custom-field-name-input" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value as FieldRow["type"])} data-testid="custom-field-type-select" className="rounded-lg border border-border bg-surface px-2 py-2 text-sm">
              {(Object.keys(TYPE_LABEL) as FieldRow["type"][]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          {needsOptions && (
            <label className="flex flex-col gap-1 text-xs">
              Opciones (separadas por comas)
              <Input value={options} onChange={(e) => setOptions(e.target.value)} required placeholder="baja, media, alta" data-testid="custom-field-options-input" />
            </label>
          )}
          <label className="flex items-center gap-1 text-xs">
            <input data-testid="custom-fields-manager-input-1" type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
            Obligatorio
          </label>
          <Button type="submit" disabled={busy || !name.trim()} data-testid="custom-field-create-button">
            Añadir campo
          </Button>
        </form>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
