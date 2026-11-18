import { toJSONSchema, z } from "zod";
import { createIssueInput, updateIssueInput } from "@/lib/issue-service";
import { placementInput } from "@/lib/rank-service";
import {
  errorBody,
  issueFilters,
  issueListResponse,
  issueResponse,
  issueTypeListResponse,
  pageParams,
  projectListResponse,
  rankResponse,
} from "@/lib/api-v1-contract";

/**
 * Especificación OpenAPI 3.1 de /api/v1, generada desde los mismos esquemas
 * Zod que validan las rutas (F0-5). No hay una copia manual que pueda
 * desviarse.
 */

type JsonSchema = Record<string, unknown>;

function schemaOf(zodSchema: z.ZodType, io: "input" | "output"): JsonSchema {
  const json = toJSONSchema(zodSchema, { io, unrepresentable: "any" }) as JsonSchema;
  // $schema solo es válido en el documento raíz; dentro de OpenAPI sobra.
  delete json.$schema;
  return json;
}

function queryParams(zodObject: z.ZodObject<z.ZodRawShape>): JsonSchema[] {
  const json = schemaOf(zodObject, "input") as { properties?: Record<string, JsonSchema>; required?: string[] };
  return Object.entries(json.properties ?? {}).map(([name, sch]) => ({
    name,
    in: "query",
    required: (json.required ?? []).includes(name),
    schema: sch,
  }));
}

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const json = (schema: JsonSchema, description: string) => ({
  description,
  content: { "application/json": { schema } },
});

const bearer = [{ bearerAuth: [] }];

export function buildOpenApiDocument(): JsonSchema {
  const listQuery = [...queryParams(pageParams as unknown as z.ZodObject<z.ZodRawShape>), ...queryParams(issueFilters)];

  return {
    openapi: "3.1.0",
    info: {
      title: "Altoke API",
      version: "1.0.0",
      description:
        "API pública v1. Autenticación con Authorization: Bearer <llave>. Los listados son paginados por cursor (máximo 100 por página). Los errores tienen la forma { error: { code, message, fields? } }.",
    },
    servers: [{ url: "/api/v1" }],
    security: bearer,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Llave creada en la cuenta (altk_...)" },
      },
      schemas: {
        Error: schemaOf(errorBody, "output"),
        IssueList: schemaOf(issueListResponse, "output"),
        Issue: schemaOf(issueResponse, "output"),
        Rank: schemaOf(rankResponse, "output"),
        ProjectList: schemaOf(projectListResponse, "output"),
        IssueTypeList: schemaOf(issueTypeListResponse, "output"),
        CreateIssueBody: schemaOf(createIssueInput.omit({ projectId: true }), "input"),
        UpdateIssueBody: schemaOf(updateIssueInput, "input"),
        RankBody: schemaOf(placementInput, "input"),
      },
    },
    paths: {
      "/projects": {
        get: {
          operationId: "listProjects",
          summary: "Lista tus proyectos",
          description: "Requiere el alcance READ.",
          parameters: queryParams(pageParams as unknown as z.ZodObject<z.ZodRawShape>),
          responses: {
            "200": json({ $ref: "#/components/schemas/ProjectList" }, "Página de proyectos"),
            "401": errorResponse("Llave ausente, inválida, revocada o caducada"),
            "422": errorResponse("Parámetros inválidos"),
            "429": errorResponse("Límite de uso excedido; ver Retry-After"),
          },
        },
      },
      "/projects/{projectId}/issue-types": {
        get: {
          operationId: "listIssueTypes",
          summary: "Lista los tipos de incidencia del proyecto",
          description: "Requiere el alcance READ.",
          parameters: [
            { name: "projectId", in: "path", required: true, schema: { type: "string" } },
            ...queryParams(pageParams as unknown as z.ZodObject<z.ZodRawShape>),
          ],
          responses: {
            "200": json({ $ref: "#/components/schemas/IssueTypeList" }, "Página de tipos"),
            "401": errorResponse("No autenticado"),
            "403": errorResponse("Sin acceso al proyecto o alcance insuficiente"),
            "422": errorResponse("Parámetros inválidos"),
          },
        },
      },
      "/projects/{projectId}/issues": {
        get: {
          operationId: "listIssues",
          summary: "Lista incidencias del proyecto",
          description: "Requiere el alcance READ. Filtros combinables; paginado por cursor.",
          parameters: [
            { name: "projectId", in: "path", required: true, schema: { type: "string" } },
            ...listQuery,
          ],
          responses: {
            "200": json({ $ref: "#/components/schemas/IssueList" }, "Página de incidencias"),
            "401": errorResponse("No autenticado"),
            "403": errorResponse("Sin acceso al proyecto o alcance insuficiente"),
            "422": errorResponse("Parámetros inválidos o cursor inválido"),
            "429": errorResponse("Límite de uso excedido; ver Retry-After"),
          },
        },
        post: {
          operationId: "createIssue",
          summary: "Crea una incidencia",
          description: "Requiere el alcance WRITE y el permiso issue.create en el proyecto.",
          parameters: [{ name: "projectId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CreateIssueBody" } } },
          },
          responses: {
            "201": json({ $ref: "#/components/schemas/Issue" }, "Incidencia creada"),
            "401": errorResponse("No autenticado"),
            "403": errorResponse("Alcance o permiso insuficiente"),
            "422": errorResponse("Datos inválidos"),
          },
        },
      },
      "/issues/{issueId}": {
        get: {
          operationId: "getIssue",
          summary: "Trae una incidencia",
          description: "Requiere el alcance READ.",
          parameters: [{ name: "issueId", in: "path", required: true, schema: { type: "string" } }],
          responses: {
            "200": json({ $ref: "#/components/schemas/Issue" }, "Incidencia"),
            "401": errorResponse("No autenticado"),
            "403": errorResponse("Sin acceso al proyecto"),
            "404": errorResponse("No existe"),
          },
        },
        patch: {
          operationId: "updateIssue",
          summary: "Actualiza una incidencia",
          description: "Requiere el alcance WRITE y el permiso issue.edit.",
          parameters: [{ name: "issueId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateIssueBody" } } },
          },
          responses: {
            "200": json({ $ref: "#/components/schemas/Issue" }, "Incidencia actualizada"),
            "401": errorResponse("No autenticado"),
            "403": errorResponse("Alcance o permiso insuficiente"),
            "404": errorResponse("No existe"),
            "422": errorResponse("Datos inválidos"),
          },
        },
      },
      "/issues/{issueId}/rank": {
        post: {
          operationId: "rankIssue",
          summary: "Coloca la incidencia entre dos vecinos",
          description:
            "Requiere el alcance WRITE y el permiso issue.edit. previousId y nextId son incidencias del mismo proyecto; null significa al principio o al final.",
          parameters: [{ name: "issueId", in: "path", required: true, schema: { type: "string" } }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/RankBody" } } },
          },
          responses: {
            "200": json({ $ref: "#/components/schemas/Rank" }, "Nuevo orden"),
            "401": errorResponse("No autenticado"),
            "403": errorResponse("Alcance o permiso insuficiente"),
            "404": errorResponse("No existe"),
            "409": errorResponse("El orden cambió; vuelve a leer y reintenta"),
            "422": errorResponse("Vecinos inválidos"),
          },
        },
      },
    },
  };
}
