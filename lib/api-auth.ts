import type { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { hashApiKey } from "@/lib/api-keys";
import type { AppUser } from "@/lib/auth";

/**
 * Resolves the user behind a `/api/v1` request's `Authorization: Bearer
 * altk_...` header. A valid key acts as its owner — same permissions as if
 * they'd signed in — so every existing permission check in lib/permissions.ts
 * works unchanged for API-key requests.
 */
export async function getApiUser(request: NextRequest): Promise<AppUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const key = authHeader.slice("Bearer ".length).trim();
  if (!key) return null;

  const snap = await adminDb.collection("apiKeys").where("keyHash", "==", hashApiKey(key)).limit(1).get();
  if (snap.empty) return null;
  const apiKeyDoc = snap.docs[0];
  const apiKey = apiKeyDoc.data();
  if (apiKey.revokedAt) return null;

  apiKeyDoc.ref.update({ lastUsedAt: new Date() }).catch(() => {});

  const userSnap = await adminDb.doc(`users/${apiKey.userId}`).get();
  if (!userSnap.exists) return null;
  const data = userSnap.data()!;
  return {
    id: userSnap.id,
    email: data.email,
    name: data.name ?? null,
    avatarUrl: data.avatarUrl ?? null,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
  };
}
