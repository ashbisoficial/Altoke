/**
 * Cookie de sesión de Altoke. Guarda una "session cookie" de Firebase Auth:
 * es httpOnly, así que el JavaScript de la página no puede leerla.
 */
export const SESSION_COOKIE = "altoke_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 5; // 5 días

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
