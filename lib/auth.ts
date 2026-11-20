import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/session";
import type { User } from "@prisma/client";

export type VerifiedSession = { uid: string; email: string | null; name: string | null };

/**
 * Verifica una cookie de sesión de Firebase. Devuelve null si no es válida,
 * si caducó o si la sesión fue revocada.
 */
export async function verifySessionValue(value: string | undefined): Promise<VerifiedSession | null> {
  if (!value) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(value, true);
    return { uid: decoded.uid, email: decoded.email ?? null, name: (decoded.name as string | undefined) ?? null };
  } catch {
    return null;
  }
}

/** Sesión verificada de la petición actual, sin tocar la base. */
export async function getSessionUid(): Promise<string | null> {
  const store = await cookies();
  return (await verifySessionValue(store.get(SESSION_COOKIE)?.value))?.uid ?? null;
}

/**
 * Usuario de la petición actual. Sincroniza la fila de nuestra tabla User
 * (id = uid de Firebase) para que las relaciones de la base sigan funcionando.
 * Devuelve null si no hay sesión válida o si la cuenta no tiene correo.
 */
export async function getSessionUser(): Promise<User | null> {
  const store = await cookies();
  const session = await verifySessionValue(store.get(SESSION_COOKIE)?.value);
  if (!session || !session.email) return null;
  return upsertUserFromSession(session);
}

export async function upsertUserFromSession(session: VerifiedSession): Promise<User> {
  return prisma.user.upsert({
    where: { id: session.uid },
    update: { email: session.email ?? undefined },
    create: { id: session.uid, email: session.email ?? `${session.uid}@sin-correo.invalid`, name: session.name },
  });
}
