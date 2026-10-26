import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/constants";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/auth-code-error",
  "/invite",
  "/api/auth/session",
  "/api/invitations",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  // Public API — authenticates itself via an Authorization: Bearer <api key>
  // header (see lib/api-auth.ts), not the session cookie.
  "/api/v1",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Public assets and Next internals never require a session.
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return true;
  return false;
}

/**
 * Next.js middleware runs in the Edge runtime, which firebase-admin can't
 * run in (it needs Node APIs) — so this only checks whether a session
 * cookie is *present*, to redirect logged-out users away from protected
 * pages without a flash of content. It does not verify the cookie's
 * signature or expiry. The real check happens in getSessionUser() (lib/auth.ts),
 * which every protected page/route handler calls and which does run in the
 * Node.js runtime — a forged or expired cookie passes this gate but is
 * rejected there.
 */
export function checkSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSession && !isPublicPath(pathname) && pathname !== "/") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
