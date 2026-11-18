"use client";

import { Input } from "@/components/ui/Input";

export type FieldDef = {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER" | "DATE" | "SELECT" | "MULTI_SELECT" | "USER";
  options: string[] | null;
  required: boolean;
};

export type PersonOption = { id: string; name: string | null; email: string };

/** Control de entrada para un campo personalizado según su tipo (F1-2). */
export function CustomFieldInput({
  def,
  value,
  people = [],
  onChange,
  onBlur,
  testId,
}: {
  def: FieldDef;
  value: unknown;
  people?: PersonOption[];
  onChange: (value: unknown) => void;
  onBlur?: () => void;
  testId: string;
}) {
  const common = { onBlur } as const;

  switch (def.type) {
    case "TEXT":
      return (
        <Input data-testid={testId}
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "NUMBER":
      return (
        <Input data-testid={testId}
          {...common}
          type="number"
          value={typeof value === "number" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
      );
    case "DATE":
      return (
        <Input data-testid={testId}
          {...common}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case "SELECT":
      return (
        <select data-testid={testId}
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm"
        >
          <option value="">Sin valor</option>
          {(def.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "MULTI_SELECT": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset data-testid={testId} className="flex flex-wrap gap-2 text-sm">
          {(def.options ?? []).map((o) => (
            <label key={o} className="flex items-center gap-1.5">
              <input data-testid={`${testId}-${o}`}
                type="checkbox"
                checked={selected.includes(o)}
                onChange={() =>
                  onChange(selected.includes(o) ? selected.filter((v) => v !== o) : [...selected, o])
                }
              />
              {o}
            </label>
          ))}
        </fieldset>
      );
    }
    case "USER":
      return (
        <select data-testid={testId}
          {...common}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-sm"
        >
          <option value="">Sin asignar</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.email}
            </option>
          ))}
        </select>
      );
  }
}
