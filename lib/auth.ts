import { cookies } from "next/headers";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/firebase/session";

/** Replaces the Prisma-generated `User` type now that users live in Firestore. */
export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
}

/**
 * Resolves the authenticated user for the current request from the Firebase
 * session cookie, and upserts the matching doc in Firestore's `users`
 * collection (email is kept in sync on every call; name is only set from the
 * Firebase Auth profile the first time, same as the old Prisma upsert did —
 * later name changes go through PATCH /api/account instead).
 *
 * Returns null when there is no valid session — callers turn that into a 401.
 */
export async function getSessionUser(): Promise<AppUser | null> {
  const cookieStore = await cookies();
  const decoded = await verifySessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!decoded || !decoded.email) return null;

  const ref = adminDb.collection("users").doc(decoded.uid);
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      email: decoded.email,
      name: (decoded.name as string | undefined) ?? null,
      avatarUrl: (decoded.picture as string | undefined) ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    const created = await ref.get();
    const data = created.data()!;
    return {
      id: decoded.uid,
      email: data.email,
      name: data.name ?? null,
      avatarUrl: data.avatarUrl ?? null,
      createdAt: data.createdAt?.toDate() ?? new Date(),
    };
  }

  const data = snap.data()!;
  if (data.email !== decoded.email) {
    await ref.update({ email: decoded.email });
    data.email = decoded.email;
  }

  return {
    id: decoded.uid,
    email: data.email,
    name: data.name ?? null,
    avatarUrl: data.avatarUrl ?? null,
    createdAt: data.createdAt?.toDate() ?? new Date(),
  };
}
