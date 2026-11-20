import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * Rutas que no necesitan sesión. Las demás exigen la cookie de sesión.
 * El middleware solo comprueba que la cookie exista (corre en el borde, sin
 * Node); la verificación real la hace cada página o ruta con getSessionUser().
 */
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/auth-code-error",
  "/invite",
  "/api/invitations",
  "/api/auth/session",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  // API pública: se autentica con "Authorization: Bearer <llave>" (lib/api-auth.ts).
  "/api/v1",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  if (!hasSession && !isPublicPath(pathname) && pathname !== "/") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: { code: "unauthenticated", message: "No autenticado" } }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
