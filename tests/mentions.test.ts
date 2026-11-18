import { describe, expect, it } from "vitest";
import { extractMentionTokens, resolveMentions } from "@/lib/mentions";

const members = [
  { id: "u1", name: "Ana Pérez", email: "ana.perez@altoke.test" },
  { id: "u2", name: "Luis", email: "luis@altoke.test" },
  { id: "u3", name: null, email: "qa.viewer@altoke.test" },
];

describe("menciones (F1-1)", () => {
  it("extrae tokens en minúsculas y sin duplicados", () => {
    expect(extractMentionTokens("hola @Luis y @luis, mira @ana.perez.")).toEqual(["luis", "ana.perez"]);
  });

  it("no toma como mención un correo ni un @ pegado a una palabra", () => {
    expect(extractMentionTokens("escribe a luis@altoke.test")).toEqual([]);
    expect(extractMentionTokens("x@y")).toEqual([]);
  });

  it("resuelve por nombre sin espacios o por parte local del correo", () => {
    expect(resolveMentions("@anaperez", members).sort()).toEqual(["u1"]);
    expect(resolveMentions("@ana.perez", members)).toEqual(["u1"]);
    expect(resolveMentions("@qa.viewer", members)).toEqual(["u3"]);
  });

  it("no notifica al autor aunque se mencione a sí mismo", () => {
    expect(resolveMentions("@luis", members, "u2")).toEqual([]);
  });

  it("una mención a alguien que no existe no produce nada", () => {
    expect(resolveMentions("@nadie", members)).toEqual([]);
  });
});
