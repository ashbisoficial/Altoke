import { describe, expect, it } from "vitest";
import { applyCustomFieldPatch, customFieldDefinitionInput, type CustomFieldDef } from "@/lib/custom-fields";

const defs: CustomFieldDef[] = [
  { id: "f-text", name: "Entorno", type: "TEXT", options: null, required: true },
  { id: "f-num", name: "Horas", type: "NUMBER", options: null, required: false },
  { id: "f-date", name: "Revisión", type: "DATE", options: null, required: false },
  { id: "f-sel", name: "Severidad", type: "SELECT", options: ["baja", "alta"], required: false },
  { id: "f-multi", name: "Módulos", type: "MULTI_SELECT", options: ["api", "ui", "db"], required: false },
  { id: "f-user", name: "Revisor", type: "USER", options: null, required: false },
];

const run = (patch: Record<string, unknown> | undefined, creating = false, current: Record<string, unknown> = {}) =>
  applyCustomFieldPatch({ defs, current, patch, creating, validUserIds: new Set(["u-ok"]) });

describe("definiciones de campo (F1-2)", () => {
  it("un campo de selección necesita opciones y no pueden repetirse", () => {
    expect(customFieldDefinitionInput.safeParse({ name: "x", type: "SELECT" }).success).toBe(false);
    expect(customFieldDefinitionInput.safeParse({ name: "x", type: "SELECT", options: ["a", "a"] }).success).toBe(false);
    expect(customFieldDefinitionInput.safeParse({ name: "x", type: "SELECT", options: ["a", "b"] }).success).toBe(true);
  });

  it("un campo de texto no acepta opciones", () => {
    expect(customFieldDefinitionInput.safeParse({ name: "x", type: "TEXT", options: ["a"] }).success).toBe(false);
  });
});

describe("valores de campo (F1-2)", () => {
  it("acepta valores válidos de cada tipo", () => {
    const out = run(
      { "f-text": "staging", "f-num": 3.5, "f-date": "2026-12-01", "f-sel": "alta", "f-multi": ["api", "db"], "f-user": "u-ok" },
      true,
    );
    expect(out).toMatchObject({ "f-text": "staging", "f-num": 3.5, "f-sel": "alta", "f-multi": ["api", "db"], "f-user": "u-ok" });
  });

  it("obligatorio: falta al crear o se intenta borrar", () => {
    expect(() => run({}, true)).toThrow(/Entorno/);
    expect(() => run({ "f-text": null }, false)).toThrow(/Entorno/);
  });

  it("rechaza tipos incorrectos con el campo señalado", () => {
    try {
      run({ "f-num": "mucho", "f-date": "01/12/2026", "f-sel": "media" }, false);
      throw new Error("debió fallar");
    } catch (e) {
      const err = e as { status: number; fields: Record<string, string[]> };
      expect(err.status).toBe(422);
      expect(Object.keys(err.fields).sort()).toEqual(["Horas", "Revisión", "Severidad"]);
    }
  });

  it("una opción no declarada en multiselección se rechaza", () => {
    expect(() => run({ "f-text": "x", "f-multi": ["api", "otra"] }, false)).toThrow(/Módulos/);
  });

  it("un usuario fuera de la organización se rechaza", () => {
    expect(() => run({ "f-text": "x", "f-user": "u-ajeno" }, false)).toThrow(/Revisor/);
  });

  it("una clave que no es campo del proyecto se rechaza, señalándola", () => {
    try {
      run({ "f-text": "x", "no-existe": 1 }, false);
      throw new Error("debió fallar");
    } catch (e) {
      expect((e as { fields: Record<string, string[]> }).fields["no-existe"]).toEqual(["No es un campo de este proyecto"]);
    }
  });

  it("null borra un valor opcional y no toca los que no vienen en el parche", () => {
    const out = run({ "f-num": null }, false, { "f-num": 2, "f-sel": "baja", "f-text": "prod" });
    expect(out).toEqual({ "f-sel": "baja", "f-text": "prod" });
  });

  it("texto de más de 2000 caracteres se rechaza", () => {
    expect(() => run({ "f-text": "x".repeat(2001) }, false)).toThrow(/Entorno/);
  });
});
