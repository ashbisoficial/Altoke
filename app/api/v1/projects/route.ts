import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getApiUser } from "@/lib/api-auth";
import { unauthorized } from "@/lib/http";
import { getAccessibleProjectIds } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const projectIds = await getAccessibleProjectIds(user.id);
  if (projectIds.length === 0) return NextResponse.json({ projects: [] });

  const snaps = await adminDb.getAll(...projectIds.map((id) => adminDb.doc(`projects/${id}`)));
  const orgIds = [...new Set(snaps.filter((s) => s.exists).map((s) => s.data()!.organizationId as string))];
  const orgSnaps = orgIds.length
    ? await adminDb.getAll(...orgIds.map((id) => adminDb.doc(`organizations/${id}`)))
    : [];
  const orgById = new Map(orgSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const projects = await Promise.all(
    snaps
      .filter((s) => s.exists)
      .map(async (s) => {
        const data = s.data()!;
        const issueCount = await adminDb.collection("issues").where("projectId", "==", s.id).count().get();
        const org = orgById.get(data.organizationId);
        return {
          id: s.id,
          key: data.key,
          name: data.name,
          organization: org ? { id: data.organizationId, name: org.name } : null,
          _count: { issues: issueCount.data().count },
        };
      }),
  );

  return NextResponse.json({ projects });
}
