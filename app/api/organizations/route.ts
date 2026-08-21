import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, unauthorized, zodErrorResponse } from "@/lib/http";
import { createDefaultRoles } from "@/lib/seed-defaults";

const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Usa solo minúsculas, números y guiones"),
});

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const organizations = await prisma.organization.findMany({
    where: { memberships: { some: { userId: user.id } } },
    include: {
      _count: { select: { projects: true, memberships: true } },
      memberships: { where: { userId: user.id }, include: { role: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ organizations });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = createOrgSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { name, slug } = parsed.data;

  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) return errorResponse(409, "Ese slug ya está en uso");

  const organization = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name, slug } });
    const roles = await createDefaultRoles(tx, org.id);
    await tx.membership.create({
      data: { userId: user.id, organizationId: org.id, roleId: roles.Admin },
    });
    return org;
  });

  return NextResponse.json({ organization }, { status: 201 });
}
