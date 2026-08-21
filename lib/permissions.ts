import { prisma } from "@/lib/prisma";
import type { SystemPermissionKey } from "@/lib/seed-defaults";

/**
 * Resolves whether a user can perform `permissionKey` on a project.
 * A project-level role (ProjectMember) is checked first; a user with no
 * explicit project membership falls back to their organization role, so
 * organization Admins can manage any project in the org without being
 * added to every one individually.
 */
export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permissionKey: SystemPermissionKey,
): Promise<boolean> {
  const projectMember = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (projectMember) {
    return projectMember.role.permissions.some((rp) => rp.permission.key === permissionKey);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) return false;

  return hasOrgPermission(userId, project.organizationId, permissionKey);
}

export async function hasOrgPermission(
  userId: string,
  organizationId: string,
  permissionKey: SystemPermissionKey,
): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!membership) return false;
  return membership.role.permissions.some((rp) => rp.permission.key === permissionKey);
}

export async function isOrgMember(userId: string, organizationId: string): Promise<boolean> {
  const membership = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return !!membership;
}

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const projectMember = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (projectMember) return true;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) return false;
  return isOrgMember(userId, project.organizationId);
}
