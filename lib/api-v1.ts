import { NextResponse } from "next/server";
import { z, type ZodError } from "zod";

/**
 * Convenciones compartidas por todas las rutas de /api/v1 (F0-5):
 *
 *  - Errores con forma fija: { error: { code, message, fields? } } y el
 *    código HTTP correcto (401, 403, 404, 409, 422).
 *  - Listados paginados por cursor, máximo 100 ítems por página. La
 *    respuesta incluye `nextCursor` (null cuando no hay más páginas).
 *
 * Las rutas de sesión (/api/**) conservan su formato anterior: esta capa
 * solo aplica a la API pública.
 */

export type ApiErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "invalid_cursor"
  | "conflict"
  | "internal_error";

const CODE_BY_STATUS: Partial<Record<number, ApiErrorCode>> = {
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  422: "validation_failed",
};

export function v1Error(
  status: number,
  message: string,
  options: { code?: ApiErrorCode; fields?: Record<string, string[] | undefined> } = {},
) {
  const code = options.code ?? CODE_BY_STATUS[status] ?? "internal_error";
  return NextResponse.json(
    { error: { code, message, ...(options.fields ? { fields: options.fields } : {}) } },
    { status },
  );
}

export const v1Unauthorized = () => v1Error(401, "No autenticado. Envía Authorization: Bearer <llave>");
export const v1Forbidden = () => v1Error(403, "No tienes permiso para esta acción");
export const v1NotFound = (what = "Recurso") => v1Error(404, `${what} no encontrado`);

export function v1ValidationError(error: ZodError) {
  return v1Error(422, "Datos inválidos", { fields: error.flatten().fieldErrors });
}

/** Convierte un error de servicio (ServiceError) en la forma v1. */
export function v1FromServiceError(status: number, message: string) {
  return v1Error(status, message);
}

// ---------------------------------------------------------------------------
// Paginación por cursor
// ---------------------------------------------------------------------------

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 50;

export const pageParams = z.object({
  limit: z.coerce
    .number({ message: "limit debe ser un número" })
    .int("limit debe ser entero")
    .min(1, "limit debe ser al menos 1")
    .max(MAX_PAGE_SIZE, `limit no puede superar ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
  cursor: z.string().min(1).optional(),
});

type CursorPosition = { createdAt: Date; id: string };

/**
 * El cursor es opaco para el cliente: codifica (createdAt, id) del último
 * ítem devuelto. Ordenar por esa pareja, y no solo por fecha, hace que la
 * paginación no repita ni salte ítems creados en el mismo milisegundo.
 */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify({ t: position.createdAt.toISOString(), id: position.id })).toString(
    "base64url",
  );
}

export function decodeCursor(cursor: string): CursorPosition | null {
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const createdAt = new Date(raw?.t);
    if (typeof raw?.id !== "string" || Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: raw.id };
  } catch {
    return null;
  }
}

/** Condición WHERE que devuelve solo lo posterior al cursor (orden descendente). */
export function afterCursorWhere(position: CursorPosition) {
  return {
    OR: [
      { createdAt: { lt: position.createdAt } },
      { createdAt: position.createdAt, id: { lt: position.id } },
    ],
  };
}

/** Orden estable que acompaña al cursor. */
export const CURSOR_ORDER_BY = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/**
 * Pide `limit + 1` filas y recorta a `limit`: si sobra una, hay página
 * siguiente y su cursor sale del último ítem devuelto.
 */
export function paginate<T extends { id: string; createdAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  };
}

// ---------------------------------------------------------------------------
// Paginación por id (para recursos sin createdAt, como los tipos de incidencia)
// ---------------------------------------------------------------------------

export function encodeIdCursor(id: string): string {
  return Buffer.from(JSON.stringify({ id })).toString("base64url");
}

export function decodeIdCursor(cursor: string): string | null {
  try {
    const raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return typeof raw?.id === "string" ? raw.id : null;
  } catch {
    return null;
  }
}

export function paginateById<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? encodeIdCursor(last.id) : null };
}
