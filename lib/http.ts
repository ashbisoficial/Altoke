import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function zodErrorResponse(error: ZodError) {
  return NextResponse.json(
    { error: "Datos inválidos", issues: error.flatten().fieldErrors },
    { status: 400 },
  );
}

export const unauthorized = () => errorResponse(401, "No autenticado");
export const forbidden = () => errorResponse(403, "No tienes permiso para esta acción");
export const notFound = (what = "Recurso") => errorResponse(404, `${what} no encontrado`);
