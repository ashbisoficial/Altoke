import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";
import { OrgMembersManager } from "@/components/organizations/OrgMembersManager";

export default async function OrganizationMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: organizationId } = await params;
  if (!(await isOrgMember(user.id, organizationId))) notFound();

  const orgSnap = await adminDb.doc(`organizations/${organizationId}`).get();
  if (!orgSnap.exists) notFound();
  const organization = orgSnap.data()!;

  const [membershipsSnap, invitationsSnap, projectsSnap, canManage] = await Promise.all([
    adminDb.collection(`organizations/${organizationId}/memberships`).orderBy("createdAt", "asc").get(),
    adminDb
      .collection("invitations")
      .where("organizationId", "==", organizationId)
      .where("status", "==", "PENDING")
      .orderBy("createdAt", "desc")
      .get(),
    adminDb.collection("projects").where("organizationId", "==", organizationId).get(),
    hasOrgPermission(user.id, organizationId, "member.manage"),
  ]);

  const memberUserIds = membershipsSnap.docs.map((d) => d.id);
  const memberUserSnaps = memberUserIds.length
    ? await adminDb.getAll(...memberUserIds.map((id) => adminDb.doc(`users/${id}`)))
    : [];
  const userById = new Map(memberUserSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const memberships = membershipsSnap.docs.map((d) => {
    const u = userById.get(d.id);
    const role = d.data().role as string;
    return {
      id: d.id,
      role: { id: role, name: role },
      user: { id: d.id, name: u?.name ?? null, email: u?.email ?? "" },
    };
  });

  const inviterIds = [...new Set(invitationsSnap.docs.map((d) => d.data().invitedById))] as string[];
  const inviterSnaps = inviterIds.length
    ? await adminDb.getAll(...inviterIds.map((id) => adminDb.doc(`users/${id}`)))
    : [];
  const inviterById = new Map(inviterSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const invitations = invitationsSnap.docs.map((d) => {
    const data = d.data();
    const inviter = inviterById.get(data.invitedById);
    return {
      id: d.id,
      token: d.id,
      email: data.email,
      status: data.status,
      emailSent: data.emailSent,
      orgRole: { name: data.orgRoleId },
      project: null as { id: string; name: string } | null,
      invitedBy: { name: inviter?.name ?? null, email: inviter?.email ?? "" },
    };
  });

  const roles = Object.keys(DEFAULT_ROLES).map((name) => ({ id: name, name }));
  const projects = projectsSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-6">
        <Link
          href="/dashboard"
          className="flex w-fit items-center gap-1 text-xs text-accent hover:underline underline-offset-4"
        >
          <ArrowLeft size={13} />
          Panel
        </Link>
        <h1 className="font-heading text-2xl font-semibold">Miembros — {organization.name}</h1>
      </header>

      <OrgMembersManager
        organizationId={organizationId}
        members={memberships}
        invitations={invitations}
        roles={roles}
        projects={projects}
        canManage={canManage}
        currentUserId={user.id}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
      />
    </main>
  );
}
