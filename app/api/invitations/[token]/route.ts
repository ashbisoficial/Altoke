import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/http";

/** Public lookup used by the /invite/[token] page — no auth required to preview. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      project: { select: { name: true } },
      orgRole: { select: { name: true } },
      projectRole: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });
  if (!invitation) return notFound("Invitación");

  return NextResponse.json({ invitation });
}
