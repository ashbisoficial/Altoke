import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashApiKey } from "@/lib/api-keys";
import type { User } from "@prisma/client";

/**
 * Resolves the user behind a `/api/v1` request's `Authorization: Bearer
 * altk_...` header. A valid key acts as its owner — same permissions as if
 * they'd signed in — so every existing permission check in lib/permissions.ts
 * works unchanged for API-key requests.
 */
export async function getApiUser(request: NextRequest): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const key = authHeader.slice("Bearer ".length).trim();
  if (!key) return null;

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    include: { user: true },
  });
  if (!apiKey || apiKey.revokedAt) return null;

  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return apiKey.user;
}
