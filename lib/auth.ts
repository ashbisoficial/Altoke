import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";

/**
 * Resolves the authenticated Supabase user for the current request and
 * upserts the matching row in our own User table (id/email are kept in
 * sync with Supabase auth on every call so a fresh signup is usable
 * immediately, without a separate provisioning step).
 *
 * Returns null when there is no session — callers turn that into a 401.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser || !authUser.email) return null;

  return prisma.user.upsert({
    where: { id: authUser.id },
    update: { email: authUser.email },
    create: {
      id: authUser.id,
      email: authUser.email,
      name: (authUser.user_metadata?.name as string | undefined) ?? null,
    },
  });
}
