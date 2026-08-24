import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, zodErrorResponse } from "@/lib/http";
import { generateApiKey } from "@/lib/api-keys";

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(80),
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
  const apiKey = await prisma.apiKey.create({
    data: { name: parsed.data.name, userId: user.id, keyHash, keyPrefix },
  });

  // The plaintext key is only ever available in this response — it isn't
  // recoverable afterwards, only the hash is stored.
  return NextResponse.json({ apiKey: { ...apiKey, key } }, { status: 201 });
}
