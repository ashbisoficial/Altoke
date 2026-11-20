import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase/admin";
import { upsertUserFromSession } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, sessionCookieOptions } from "@/lib/session";

const bodySchema = z.object({ idToken: z.string().min(10).max(4096) });

/**
 * Crea la cookie de sesión a partir de un ID token recién emitido por el
 * cliente de Firebase. El ID token dura una hora; la cookie, cinco días.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Falta el token de sesión" }, { status: 400 });

  let sessionCookie: string;
  let uid: string;
  try {
    const auth = adminAuth();
    const decoded = await auth.verifyIdToken(parsed.data.idToken, true);
    // Solo se aceptan tokens emitidos hace poco: evita reutilizar uno viejo.
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      return NextResponse.json({ error: "Vuelve a iniciar sesión" }, { status: 401 });
    }
    uid = decoded.uid;
    sessionCookie = await auth.createSessionCookie(parsed.data.idToken, { expiresIn: SESSION_MAX_AGE_SECONDS * 1000 });
    if (!decoded.email) return NextResponse.json({ error: "La cuenta no tiene correo" }, { status: 422 });
    await upsertUserFromSession({ uid, email: decoded.email, name: (decoded.name as string | undefined) ?? null });
  } catch {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieOptions());
  return response;
}

/** Cierra la sesión: borra la cookie. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
