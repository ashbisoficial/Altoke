import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/api-keys";
import { v1Error } from "@/lib/api-v1";
import type { ApiKeyScope, User } from "@prisma/client";

export type ApiAuth =
  | { ok: true; user: User; apiKeyId: string }
  | { ok: false; response: NextResponse };

const WINDOW_SECONDS = 60;

/**
 * Autentica una petición de /api/v1 con `Authorization: Bearer altk_...` y
 * comprueba, en este orden: la llave existe y no está revocada, no ha
 * caducado, no excede su límite por minuto (429 con Retry-After) y tiene el
 * alcance que pide la ruta (403).
 *
 * Una llave actúa como su dueño: las comprobaciones de permisos de
 * lib/permissions.ts siguen aplicando igual.
 */
export async function authenticateApi(request: NextRequest, scope: ApiKeyScope): Promise<ApiAuth> {
  const authHeader = request.headers.get("authorization");
  const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  if (!raw) return fail(v1Error(401, "No autenticado. Envía Authorization: Bearer <llave>", { code: "unauthenticated" }));

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(raw) },
    include: { user: true },
  });
  if (!apiKey || apiKey.revokedAt) {
    return fail(v1Error(401, "Llave inválida o revocada", { code: "unauthenticated" }));
  }
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    return fail(v1Error(401, "La llave ha caducado", { code: "key_expired" }));
  }

  const limit = await consumeRateLimit(apiKey.id, apiKey.requestsPerMinute);
  if (!limit.allowed) {
    const res = v1Error(429, "Demasiadas peticiones; espera antes de reintentar", { code: "rate_limited" });
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return fail(res);
  }

  if (!apiKey.scopes.includes(scope)) {
    return fail(
      v1Error(403, `La llave no tiene el alcance ${scope}`, { code: "insufficient_scope" }),
    );
  }

  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { ok: true, user: apiKey.user, apiKeyId: apiKey.id };
}

function fail(response: NextResponse): ApiAuth {
  return { ok: false, response };
}

/**
 * Contador de peticiones por llave y minuto. Un único UPSERT atómico: dos
 * peticiones simultáneas no pueden perder un incremento.
 */
export async function consumeRateLimit(apiKeyId: string, limitPerMinute: number) {
  const now = Date.now();
  const windowStartMs = Math.floor(now / (WINDOW_SECONDS * 1000)) * WINDOW_SECONDS * 1000;
  const windowStart = new Date(windowStartMs);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ApiKeyWindow" ("apiKeyId", "windowStart", "count")
    VALUES (${apiKeyId}, ${windowStart}, 1)
    ON CONFLICT ("apiKeyId", "windowStart")
    DO UPDATE SET "count" = "ApiKeyWindow"."count" + 1
    RETURNING "count"
  `;
  const count = Number(rows[0]?.count ?? 0);

  // Limpieza ocasional de ventanas viejas, para que la tabla no crezca sin límite.
  if (Math.random() < 0.02) {
    const cutoff = new Date(now - 60 * 60 * 1000);
    prisma.$executeRaw`DELETE FROM "ApiKeyWindow" WHERE "windowStart" < ${cutoff}`.catch(() => {});
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + WINDOW_SECONDS * 1000 - now) / 1000));
  return { allowed: count <= limitPerMinute, retryAfterSeconds };
}
