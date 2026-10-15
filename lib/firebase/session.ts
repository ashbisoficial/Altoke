import { adminAuth } from "@/lib/firebase/admin";

export const SESSION_COOKIE_NAME = "__session";
const SESSION_EXPIRES_IN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days, matches cookie maxAge below

/** Exchanges a freshly-signed-in client ID token for a long-lived session cookie. */
export async function createSessionCookie(idToken: string) {
  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_EXPIRES_IN_MS,
  });
  return { sessionCookie, maxAge: SESSION_EXPIRES_IN_MS / 1000 };
}

/**
 * Verifies a session cookie against Firebase Auth (checks signature, expiry,
 * and — unlike a bare ID token — revocation). Returns null instead of
 * throwing so callers can turn a missing/invalid session into a 401.
 */
export async function verifySessionCookie(sessionCookie: string | undefined) {
  if (!sessionCookie) return null;
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }
}
