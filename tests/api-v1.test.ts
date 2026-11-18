import { describe, expect, it } from "vitest";
import {
  decodeCursor,
  decodeIdCursor,
  encodeCursor,
  encodeIdCursor,
  paginate,
  paginateById,
  pageParams,
} from "@/lib/api-v1";
import { assertValidSprintDates, completeSprintInput } from "@/lib/sprint-service";
import { ServiceError } from "@/lib/issue-service";

describe("paginación por cursor (F0-5)", () => {
  it("el cursor ida y vuelta conserva fecha e id", () => {
    const position = { createdAt: new Date("2026-11-18T10:00:00.123Z"), id: "cabc123" };
    const decoded = decodeCursor(encodeCursor(position));
    expect(decoded).toEqual(position);
  });

  it("rechaza cursores que no son base64 JSON válido", () => {
    expect(decodeCursor("no-es-un-cursor!!")).toBeNull();
    expect(decodeCursor(Buffer.from("{}").toString("base64url"))).toBeNull();
  });

  it("limit: por defecto 50, máximo 100, entero y positivo", () => {
    expect(pageParams.parse({}).limit).toBe(50);
    expect(pageParams.parse({ limit: "100" }).limit).toBe(100);
    expect(pageParams.safeParse({ limit: "101" }).success).toBe(false);
    expect(pageParams.safeParse({ limit: "0" }).success).toBe(false);
    expect(pageParams.safeParse({ limit: "2.5" }).success).toBe(false);
  });

  it("paginate devuelve nextCursor solo si hay más filas", () => {
    const rows = [1, 2, 3].map((n) => ({ id: `id${n}`, createdAt: new Date(2026, 0, n) }));
    const first = paginate(rows, 2);
    expect(first.items.map((r) => r.id)).toEqual(["id1", "id2"]);
    expect(first.nextCursor).not.toBeNull();
    expect(decodeCursor(first.nextCursor!)).toEqual({ createdAt: rows[1].createdAt, id: "id2" });

    const last = paginate(rows.slice(0, 2), 2);
    expect(last.nextCursor).toBeNull();
  });

  it("paginateById usa el id como cursor", () => {
    const rows = [{ id: "c3" }, { id: "c2" }, { id: "c1" }];
    const page = paginateById(rows, 2);
    expect(page.items.map((r) => r.id)).toEqual(["c3", "c2"]);
    expect(decodeIdCursor(page.nextCursor!)).toBe("c2");
    expect(encodeIdCursor("c2")).toBe(page.nextCursor);
  });
});

describe("ciclo de vida de sprint (F0-6)", () => {
  const day = (d: number) => new Date(Date.UTC(2026, 10, d));

  it("fecha de fin posterior a la de inicio", () => {
    expect(() => assertValidSprintDates(day(10), day(20))).not.toThrow();
    expect(() => assertValidSprintDates(day(20), day(10))).toThrow(ServiceError);
    expect(() => assertValidSprintDates(day(10), day(10))).toThrow(ServiceError);
    expect(() => assertValidSprintDates(null, day(10))).not.toThrow();
  });

  it("mover a sprint siguiente exige nextSprintId", () => {
    expect(completeSprintInput.safeParse({ target: "NEXT_SPRINT" }).success).toBe(false);
    expect(completeSprintInput.safeParse({ target: "NEXT_SPRINT", nextSprintId: "s2" }).success).toBe(true);
    expect(completeSprintInput.parse({}).target).toBe("BACKLOG");
  });
});
