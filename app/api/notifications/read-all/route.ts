import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
