import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { hasOrgPermission, isOrgMember } from "@/lib/permissions";
import { OrgMembersManager } from "@/components/organizations/OrgMembersManager";

export default async function OrganizationMembersPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { id: organizationId } = await params;
  if (!(await isOrgMember(user.id, organizationId))) notFound();

  const [organization, memberships, invitations, roles, projects, canManage] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true } }, role: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { organizationId, status: "PENDING" },
      include: {
        orgRole: { select: { name: true } },
        project: { select: { id: true, name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { organizationId }, select: { id: true, name: true } }),
    hasOrgPermission(user.id, organizationId, "member.manage"),
  ]);
  if (!organization) notFound();

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
        organizationId={organization.id}
        members={memberships}
        invitations={invitations}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        projects={projects}
        canManage={canManage}
        currentUserId={user.id}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}
      />
    </main>
  );
}
