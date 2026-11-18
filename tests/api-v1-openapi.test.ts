import { describe, expect, it } from "vitest";
import { buildOpenApiDocument } from "@/lib/api-v1-openapi";

/** F0-5: la especificación es estructuralmente válida y todas sus referencias resuelven. */
type Json = Record<string, unknown>;

function collectRefs(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node as Json)) {
      if (k === "$ref" && typeof v === "string") out.push(v);
      else collectRefs(v, out);
    }
  }
  return out;
}

describe("especificación OpenAPI de /api/v1", () => {
  const doc = buildOpenApiDocument() as Json & {
    paths: Record<string, Record<string, { operationId: string; responses: Record<string, unknown> }>>;
    components: { schemas: Record<string, unknown> };
  };

  it("declara OpenAPI 3.1 y título", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect((doc.info as { title: string }).title).toBe("Altoke API");
  });

  it("toda referencia $ref apunta a un esquema que existe", () => {
    const refs = collectRefs(doc);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      const name = ref.replace("#/components/schemas/", "");
      expect(doc.components.schemas, ref).toHaveProperty(name);
    }
  });

  it("cada operación tiene operationId único y al menos una respuesta de éxito", () => {
    const ids: string[] = [];
    for (const methods of Object.values(doc.paths)) {
      for (const op of Object.values(methods)) {
        ids.push(op.operationId);
        expect(Object.keys(op.responses).some((code) => code.startsWith("2"))).toBe(true);
      }
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("los listados declaran el límite de 100 por página y los filtros", () => {
    const list = doc.paths["/projects/{projectId}/issues"].get as unknown as {
      parameters: { name: string; schema: { maximum?: number } }[];
    };
    const names = list.parameters.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["limit", "cursor", "status", "type", "assignee", "sprint", "updatedSince"]));
    expect(list.parameters.find((p) => p.name === "limit")?.schema.maximum).toBe(100);
  });

  it("el cuerpo de creación no pide projectId (viene de la ruta)", () => {
    const body = doc.components.schemas.CreateIssueBody as { properties: Record<string, unknown> };
    expect(body.properties).not.toHaveProperty("projectId");
    expect(body.properties).toHaveProperty("title");
  });
});
