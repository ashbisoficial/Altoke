"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomFieldInput, type FieldDef, type PersonOption } from "./CustomFieldInput";

/**
 * Bloque de campos personalizados del detalle de una incidencia (F1-2). Cada
 * valor se guarda al cambiarlo (selecciones) o al salir del campo (texto).
 */
export function CustomFieldsSection({
  issueId,
  defs,
  values,
  people,
}: {
  issueId: string;
  defs: FieldDef[];
  values: Record<string, unknown>;
  people: PersonOption[];
}) {
  const router = useRouter();
  const [local, setLocal] = useState<Record<string, unknown>>(values);
  const [error, setError] = useState<string | null>(null);

  if (defs.length === 0) return null;

  async function save(id: string, value: unknown) {
    setError(null);
    const res = await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customFields: { [id]: value } }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const detail = data.fields ? Object.values(data.fields).flat().join(" ") : data.error;
      setError(detail ?? "No se pudo guardar el campo");
      setLocal(values);
      return;
    }
    router.refresh();
  }

  return (
    <section data-testid="custom-fields-section">
      <h2 className="mb-2 text-sm font-semibold text-ink/70">Campos</h2>
      <div className="flex flex-col gap-3">
        {defs.map((def) => (
          <label key={def.id} className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-ink/70">
              {def.name}
              {def.required && <span className="text-red-600"> *</span>}
            </span>
            <CustomFieldInput
              def={def}
              value={local[def.id]}
              people={people}
              testId={`custom-field-${def.name.toLowerCase().replace(/\s+/g, "-")}`}
              onChange={(v) => {
                setLocal((prev) => ({ ...prev, [def.id]: v ?? undefined }));
                if (def.type !== "TEXT") void save(def.id, v);
              }}
              onBlur={def.type === "TEXT" ? () => save(def.id, local[def.id] ?? null) : undefined}
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </section>
  );
}
