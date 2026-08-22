import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { unauthorized, zodErrorResponse } from "@/lib/http";

const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(100).nullable(),
});

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = updateAccountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ user: updated });
}
