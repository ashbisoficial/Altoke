import { z } from "zod";
import { ServiceError } from "@/lib/service-error";

/**
 * Campos personalizados por proyecto (F1-2). Esta parte es pura: define las
 * reglas de tipo y de obligatoriedad. Los valores se guardan en
 * Issue.customFields, indexados por el id del campo.
 */

export const CUSTOM_FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "SELECT", "MULTI_SELECT", "USER"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export type CustomFieldDef = {
  id: string;
  name: string;
  type: CustomFieldType;
  options: string[] | null;
  required: boolean;
};

export const customFieldDefinitionInput = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(60),
    type: z.enum(CUSTOM_FIELD_TYPES),
    options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    required: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    const needsOptions = v.type === "SELECT" || v.type === "MULTI_SELECT";
    if (needsOptions) {
      const unique = new Set(v.options ?? []);
      if (unique.size === 0) ctx.addIssue({ code: "custom", path: ["options"], message: "Añade al menos una opción" });
      if (unique.size !== (v.options ?? []).length) {
        ctx.addIssue({ code: "custom", path: ["options"], message: "Las opciones no pueden repetirse" });
      }
    } else if (v.options && v.options.length > 0) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Solo los campos de selección tienen opciones" });
    }
  });

export type FieldErrors = Record<string, string[]>;

/** Valida un valor contra la definición de su campo. Devuelve el valor normalizado o un error. */
function checkValue(def: CustomFieldDef, raw: unknown): { ok: true; value: unknown } | { ok: false; message: string } {
  switch (def.type) {
    case "TEXT": {
      if (typeof raw !== "string") return { ok: false, message: "Debe ser texto" };
      if (raw.length > 2000) return { ok: false, message: "Máximo 2000 caracteres" };
      return { ok: true, value: raw.trim() };
    }
    case "NUMBER": {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return { ok: false, message: "Debe ser un número" };
      return { ok: true, value: raw };
    }
    case "DATE": {
      if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
        return { ok: false, message: "Debe ser una fecha AAAA-MM-DD" };
      }
      return { ok: true, value: raw };
    }
    case "SELECT": {
      if (typeof raw !== "string" || !(def.options ?? []).includes(raw)) {
        return { ok: false, message: "Elige una de las opciones" };
      }
      return { ok: true, value: raw };
    }
    case "MULTI_SELECT": {
      if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string" && (def.options ?? []).includes(v))) {
        return { ok: false, message: "Elige solo opciones válidas" };
      }
      return { ok: true, value: [...new Set(raw)] };
    }
    case "USER": {
      if (typeof raw !== "string" || raw.length === 0) return { ok: false, message: "Debe ser una persona" };
      return { ok: true, value: raw };
    }
  }
}

/**
 * Aplica un parche de valores sobre los valores actuales.
 *  - Un valor null (o "") borra el campo; si es obligatorio, es un error.
 *  - Los campos que no están en el parche no cambian.
 *  - Un campo obligatorio sin valor al crear es un error.
 *  - Una clave que no es un campo del proyecto es un error (422).
 *  - `validUserIds` restringe los campos USER a personas de la organización.
 */
export function applyCustomFieldPatch({
  defs,
  current,
  patch,
  creating,
  validUserIds,
}: {
  defs: CustomFieldDef[];
  current: Record<string, unknown>;
  patch: Record<string, unknown> | undefined;
  creating: boolean;
  validUserIds?: Set<string>;
}): Record<string, unknown> {
  const errors: FieldErrors = {};
  const next: Record<string, unknown> = { ...current };
  const byId = new Map(defs.map((d) => [d.id, d]));

  for (const key of Object.keys(patch ?? {})) {
    if (!byId.has(key)) errors[key] = ["No es un campo de este proyecto"];
  }

  for (const def of defs) {
    const provided = patch !== undefined && Object.prototype.hasOwnProperty.call(patch, def.id);
    if (!provided) {
      if (creating && def.required) errors[def.name] = ["Es obligatorio"];
      continue;
    }
    const raw = patch![def.id];
    const empty = raw === null || raw === "" || (Array.isArray(raw) && raw.length === 0);
    if (empty) {
      if (def.required) {
        errors[def.name] = ["Es obligatorio"];
      } else {
        delete next[def.id];
      }
      continue;
    }
    const result = checkValue(def, raw);
    if (!result.ok) {
      errors[def.name] = [result.message];
      continue;
    }
    if (def.type === "USER" && validUserIds && !validUserIds.has(result.value as string)) {
      errors[def.name] = ["La persona no pertenece a la organización"];
      continue;
    }
    next[def.id] = result.value;
  }

  if (Object.keys(errors).length > 0) {
    throw new ServiceError(422, `Campos personalizados inválidos: ${Object.keys(errors).join(", ")}`, errors);
  }
  return next;
}
