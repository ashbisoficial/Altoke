import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, zodErrorResponse } from "@/lib/http";
import { generateApiKey } from "@/lib/api-keys";

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

function serializeKey(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: data.name,
    keyPrefix: data.keyPrefix,
    createdAt: tsToISO(data.createdAt),
    lastUsedAt: tsToISO(data.lastUsedAt),
    revokedAt: tsToISO(data.revokedAt),
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const snap = await adminDb.collection("apiKeys").where("userId", "==", user.id).orderBy("createdAt", "desc").get();
  const apiKeys = snap.docs.map((d) => serializeKey(d.id, d.data()));

  return NextResponse.json({ apiKeys });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { key, keyHash, keyPrefix } = generateApiKey();
  const ref = await adminDb.collection("apiKeys").add({
    name: parsed.data.name,
    userId: user.id,
    keyHash,
    keyPrefix,
    createdAt: FieldValue.serverTimestamp(),
    lastUsedAt: null,
    revokedAt: null,
  });
  const created = await ref.get();

  // The plaintext key is only ever available in this response — it isn't
  // recoverable afterwards, only the hash is stored.
  return NextResponse.json({ apiKey: { ...serializeKey(ref.id, created.data()!), key } }, { status: 201 });
}
