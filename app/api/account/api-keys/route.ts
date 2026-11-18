import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, zodErrorResponse } from "@/lib/http";
import { generateApiKey } from "@/lib/api-keys";

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z
    .array(z.enum(["READ", "WRITE", "TEST_RESULTS"]))
    .min(1, "Elige al menos un alcance")
    .max(3)
    .optional(),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365)]).nullable().optional(),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      expiresAt: true,
      requestsPerMinute: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ apiKeys });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createKeySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { key, keyHash, keyPrefix } = generateApiKey();
  const { name, scopes, expiresInDays } = parsed.data;
  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      userId: user.id,
      keyHash,
      keyPrefix,
      scopes: scopes ?? ["READ"],
      expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null,
    },
  });

  // The plaintext key is only ever available in this response — it isn't
  // recoverable afterwards, only the hash is stored.
  return NextResponse.json({ apiKey: { ...apiKey, key } }, { status: 201 });
}
