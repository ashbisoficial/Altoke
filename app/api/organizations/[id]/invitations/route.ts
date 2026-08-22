import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

const INVITE_TTL_DAYS = 14;

const createInvitationSchema = z
  .object({
    email: z.string().trim().email(),
    orgRoleId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    projectRoleId: z.string().min(1).optional(),
  })
  .refine((data) => !data.projectId === !data.projectRoleId, {
    message: "projectId y projectRoleId deben ir juntos",
  });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();

  const invitations = await prisma.invitation.findMany({
    where: { organizationId, status: "PENDING" },
    include: {
      orgRole: { select: { name: true } },
      project: { select: { id: true, name: true } },
      projectRole: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invitations });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await hasOrgPermission(user.id, organizationId, "member.manage"))) return forbidden();

  const parsed = createInvitationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { email, orgRoleId, projectId, projectRoleId } = parsed.data;

  const [organization, orgRole] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.role.findFirst({ where: { id: orgRoleId, organizationId } }),
  ]);
  if (!organization) return errorResponse(404, "Organización no encontrada");
  if (!orgRole) return errorResponse(400, "Rol de organización inválido");

  if (projectId || projectRoleId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) return errorResponse(400, "El proyecto debe pertenecer a esta organización");
    const projectRole = await prisma.role.findFirst({ where: { id: projectRoleId, organizationId } });
    if (!projectRole) return errorResponse(400, "Rol de proyecto inválido");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: existingUser.id, organizationId } },
    });
    if (alreadyMember) return errorResponse(409, "Ese usuario ya pertenece a la organización");
  }

  const existingInvite = await prisma.invitation.findFirst({
    where: { organizationId, email, status: "PENDING" },
  });
  if (existingInvite) return errorResponse(409, "Ya hay una invitación pendiente para ese correo");

  const invitation = await prisma.invitation.create({
    data: {
      email,
      organizationId,
      orgRoleId,
      projectId,
      projectRoleId,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteLink = `${siteUrl}/invite/${invitation.token}`;

  let emailed = false;
  if (!existingUser) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(`/invite/${invitation.token}`)}`,
      });
      emailed = !error;
    } catch {
      emailed = false;
    }
  } else {
    // Existing Altoke user — no need for a Supabase auth email, they can log
    // in as usual. Let them know inside the app instead.
    await notify({
      userId: existingUser.id,
      actorId: user.id,
      type: "ORG_INVITATION",
      title: `Te invitaron a ${organization.name}`,
      link: `/invite/${invitation.token}`,
    });
  }

  if (emailed) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { emailSent: true } });
  }

  return NextResponse.json({ invitation, inviteLink, emailed }, { status: 201 });
}
