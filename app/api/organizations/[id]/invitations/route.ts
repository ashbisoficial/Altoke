import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";
import { notify } from "@/lib/notifications";
import { sendInvitationEmail } from "@/lib/email";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";

const INVITE_TTL_DAYS = 14;
const roleEnum = z.enum(Object.keys(DEFAULT_ROLES) as [string, ...string[]]);

const createInvitationSchema = z
  .object({
    email: z.string().trim().email(),
    orgRoleId: roleEnum,
    projectId: z.string().min(1).optional(),
    projectRoleId: roleEnum.optional(),
  })
  .refine((data) => !data.projectId === !data.projectRoleId, {
    message: "projectId y projectRoleId deben ir juntos",
  });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();

  const snap = await adminDb
    .collection("invitations")
    .where("organizationId", "==", organizationId)
    .where("status", "==", "PENDING")
    .orderBy("createdAt", "desc")
    .get();

  const projectIds = [...new Set(snap.docs.map((d) => d.data().projectId).filter(Boolean))] as string[];
  const inviterIds = [...new Set(snap.docs.map((d) => d.data().invitedById))] as string[];
  const [projectSnaps, inviterSnaps] = await Promise.all([
    projectIds.length ? adminDb.getAll(...projectIds.map((id) => adminDb.doc(`projects/${id}`))) : [],
    inviterIds.length ? adminDb.getAll(...inviterIds.map((id) => adminDb.doc(`users/${id}`))) : [],
  ]);
  const projectById = new Map(projectSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));
  const inviterById = new Map(inviterSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const invitations = snap.docs.map((d) => {
    const data = d.data();
    const inviter = inviterById.get(data.invitedById);
    const project = data.projectId ? projectById.get(data.projectId) : undefined;
    return {
      id: d.id,
      token: d.id,
      email: data.email,
      status: data.status,
      emailSent: data.emailSent,
      orgRole: { name: data.orgRoleId },
      project: project ? { id: data.projectId, name: project.name } : null,
      invitedBy: { name: inviter?.name ?? null, email: inviter?.email ?? "" },
    };
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

  const orgSnap = await adminDb.doc(`organizations/${organizationId}`).get();
  if (!orgSnap.exists) return errorResponse(404, "Organización no encontrada");
  const organization = orgSnap.data()!;

  if (projectId) {
    const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
    if (!projectSnap.exists || projectSnap.data()!.organizationId !== organizationId) {
      return errorResponse(400, "El proyecto debe pertenecer a esta organización");
    }
  }

  const existingUserSnap = await adminDb.collection("users").where("email", "==", email).limit(1).get();
  const existingUser = existingUserSnap.empty
    ? null
    : { id: existingUserSnap.docs[0].id, ...existingUserSnap.docs[0].data() };

  if (existingUser) {
    const alreadyMember = await adminDb.doc(`organizations/${organizationId}/memberships/${existingUser.id}`).get();
    if (alreadyMember.exists) return errorResponse(409, "Ese usuario ya pertenece a la organización");
  }

  const existingInvite = await adminDb
    .collection("invitations")
    .where("organizationId", "==", organizationId)
    .where("email", "==", email)
    .where("status", "==", "PENDING")
    .limit(1)
    .get();
  if (!existingInvite.empty) return errorResponse(409, "Ya hay una invitación pendiente para ese correo");

  const invitationRef = adminDb.collection("invitations").doc();
  const expiresAt = Timestamp.fromMillis(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  await invitationRef.set({
    email,
    organizationId,
    orgRoleId,
    projectId: projectId ?? null,
    projectRoleId: projectRoleId ?? null,
    invitedById: user.id,
    status: "PENDING",
    emailSent: false,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteLink = `${siteUrl}/invite/${invitationRef.id}`;

  let emailed = false;
  if (!existingUser) {
    emailed = await sendInvitationEmail({ to: email, orgName: organization.name, inviteLink });
  } else {
    await notify({
      userId: existingUser.id,
      actorId: user.id,
      type: "ORG_INVITATION",
      title: `Te invitaron a ${organization.name}`,
      link: `/invite/${invitationRef.id}`,
    });
  }

  if (emailed) await invitationRef.update({ emailSent: true });

  return NextResponse.json(
    {
      invitation: { id: invitationRef.id, token: invitationRef.id, email, status: "PENDING" },
      inviteLink,
      emailed,
    },
    { status: 201 },
  );
}
