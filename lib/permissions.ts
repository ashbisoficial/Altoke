import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_ROLES, type SystemPermissionKey } from "@/lib/seed-defaults";

type RoleName = keyof typeof DEFAULT_ROLES;

function roleHasPermission(role: string | undefined, permissionKey: SystemPermissionKey): boolean {
  if (!role || !(role in DEFAULT_ROLES)) return false;
  return DEFAULT_ROLES[role as RoleName].includes(permissionKey);
}

/**
 * Resolves whether a user can perform `permissionKey` on a project.
 * A project-level role (projects/{id}/members/{uid}) is checked first; a
 * user with no explicit project membership falls back to their organization
 * role, so organization Admins can manage any project in the org without
 * being added to every one individually.
 *
 * Roles are the fixed Admin/Member/Viewer set (lib/seed-defaults.ts) — no
 * custom roles, no role/permission join table, so this is a single doc read
 * plus a lookup against that static catalog (no joins, unlike the old
 * Prisma version).
 */
export async function hasProjectPermission(
  userId: string,
  projectId: string,
  permissionKey: SystemPermissionKey,
): Promise<boolean> {
  const memberSnap = await adminDb.doc(`projects/${projectId}/members/${userId}`).get();
  if (memberSnap.exists) {
    return roleHasPermission(memberSnap.data()?.role, permissionKey);
  }

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  const organizationId = projectSnap.data()?.organizationId as string | undefined;
  if (!organizationId) return false;

  return hasOrgPermission(userId, organizationId, permissionKey);
}

export async function hasOrgPermission(
  userId: string,
  organizationId: string,
  permissionKey: SystemPermissionKey,
): Promise<boolean> {
  const membershipSnap = await adminDb.doc(`organizations/${organizationId}/memberships/${userId}`).get();
  if (!membershipSnap.exists) return false;
  return roleHasPermission(membershipSnap.data()?.role, permissionKey);
}

export async function isOrgMember(userId: string, organizationId: string): Promise<boolean> {
  const snap = await adminDb.doc(`organizations/${organizationId}/memberships/${userId}`).get();
  return snap.exists;
}

/**
 * All project ids a user can see: projects they're a direct member of, plus
 * every project in an organization they belong to (org membership implies
 * access to all its projects, same fallback hasProjectPermission uses).
 * Used for cross-project views (search, the public API's project list).
 */
export async function getAccessibleProjectIds(userId: string): Promise<string[]> {
  const [projectMemberships, orgMemberships] = await Promise.all([
    adminDb.collectionGroup("members").where("userId", "==", userId).get(),
    adminDb.collectionGroup("memberships").where("userId", "==", userId).get(),
  ]);

  const orgIds = orgMemberships.docs.map((d) => d.ref.parent.parent?.id).filter((v): v is string => Boolean(v));
  const directProjectIds = projectMemberships.docs
    .map((d) => d.ref.parent.parent?.id)
    .filter((v): v is string => Boolean(v));

  const orgProjectSnaps = orgIds.length
    ? await adminDb.collection("projects").where("organizationId", "in", orgIds.slice(0, 30)).get()
    : null;

  return [...new Set([...directProjectIds, ...(orgProjectSnaps?.docs.map((d) => d.id) ?? [])])];
}

export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const memberSnap = await adminDb.doc(`projects/${projectId}/members/${userId}`).get();
  if (memberSnap.exists) return true;

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  const organizationId = projectSnap.data()?.organizationId as string | undefined;
  if (!organizationId) return false;

  return isOrgMember(userId, organizationId);
}
