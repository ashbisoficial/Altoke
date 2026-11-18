import { describe, expect, it } from "vitest";
import { buildIssueOrder, filterQueryString, parseListQuery } from "@/lib/issue-query";

const sp = (s: string) => new URLSearchParams(s);

describe("URL de la lista (F1-3)", () => {
  it("valores no reconocidos se ignoran sin error", () => {
    const q = parseListQuery(sp("sort=inventado&cols=nope&priority=URGENTE&page=abc"));
    expect(q.sort).toBeNull();
    expect(q.columns).toEqual(["key", "title", "status", "priority", "assignee", "updatedAt"]);
    expect(q.priorities).toEqual([]);
    expect(q.page).toBe(1);
  });

  it("el orden descendente empieza con guion", () => {
    expect(parseListQuery(sp("sort=-updatedAt")).sort).toEqual({ field: "updatedAt", dir: "desc" });
    expect(parseListQuery(sp("sort=title")).sort).toEqual({ field: "title", dir: "asc" });
  });

  it("las columnas se eligen con valores repetidos y no se duplican", () => {
    expect(parseListQuery(sp("cols=key&cols=dueDate&cols=key")).columns).toEqual(["key", "dueDate"]);
  });

  it("varios estados y varias prioridades se leen como listas", () => {
    const q = parseListQuery(sp("status=a&status=b&priority=HIGH&priority=LOW"));
    expect(q.statuses).toEqual(["a", "b"]);
    expect(q.priorities).toEqual(["HIGH", "LOW"]);
  });

  it("los campos personalizados se leen por id con el prefijo cf.", () => {
    const q = parseListQuery(sp("cf.f1=hola&cf.f2=&cf.otro=x"), [{ id: "f1", name: "a", type: "TEXT", options: null }]);
    expect(q.custom).toEqual({ f1: "hola" });
  });

  it("la página se acota entre 1 y 10000", () => {
    expect(parseListQuery(sp("page=0")).page).toBe(1);
    expect(parseListQuery(sp("page=99999")).page).toBe(10000);
  });

  it("el filtro guardado no fija la página", () => {
    expect(filterQueryString(sp("status=a&page=7&sort=-title&q="))).toBe("status=a&sort=-title");
  });

  it("el orden termina en id para que la paginación sea estable", () => {
    expect(buildIssueOrder({ field: "status", dir: "desc" })).toEqual([{ status: { order: "desc" } }, { id: "asc" }]);
    expect(buildIssueOrder(null).at(-1)).toEqual({ id: "asc" });
  });
});
