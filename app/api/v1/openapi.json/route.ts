import { NextResponse } from "next/server";
import { buildOpenApiDocument } from "@/lib/api-v1-openapi";

/** Especificación OpenAPI de la API v1 (pública: no contiene datos). */
export function GET() {
  return NextResponse.json(buildOpenApiDocument(), {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
