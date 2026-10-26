import { adminAuth, adminDb } from "@/lib/firebase/admin";

/**
 * Rebuilds a user's Firebase Auth custom claims from their current org and
 * project memberships: { orgs: { [orgId]: role }, projects: { [projectId]: role } }.
 *
 * Custom claims are a full overwrite (no partial update), so this re-reads
 * every membership the user has rather than patching in just the one that
 * changed. Call it after any write to organizations/{id}/memberships/{uid}
 * or projects/{id}/members/{uid}.
 *
 * Why claims exist at all: API routes authorize via lib/permissions.ts
 * (Admin SDK, bypasses Security Rules) same as always — claims only matter
 * for the few places a client reads Firestore directly (the mural's live
 * listener, phase 8), so Security Rules can check membership from
 * request.auth.token without an extra read.
 *
 * Requires every membership doc to carry a denormalized `userId` field
 * (equal to its own doc id) so it's queryable via collectionGroup — Firestore
 * can't filter a collectionGroup query by document id.
 */
export async function syncUserClaims(userId: string): Promise<void> {
  const [orgMemberships, projectMemberships] = await Promise.all([
    adminDb.collectionGroup("memberships").where("userId", "==", userId).get(),
    adminDb.collectionGroup("members").where("userId", "==", userId).get(),
  ]);

  const orgs: Record<string, string> = {};
  for (const doc of orgMemberships.docs) {
    const orgId = doc.ref.parent.parent?.id;
    if (orgId) orgs[orgId] = doc.data().role;
  }

  const projects: Record<string, string> = {};
  for (const doc of projectMemberships.docs) {
    const projectId = doc.ref.parent.parent?.id;
    if (projectId) projects[projectId] = doc.data().role;
  }

  await adminAuth.setCustomUserClaims(userId, { orgs, projects });
}
