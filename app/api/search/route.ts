import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth";
import { unauthorized } from "@/lib/http";
import { getAccessibleProjectIds } from "@/lib/permissions";

/**
 * Firestore has no case-insensitive "contains" or OR-across-fields query, so
 * this resolves the accessible projects first, pulls back the most recently
 * updated issues in them (bounded), and filters/ranks in memory. Fine at
 * this app's scale; a real full-text search (e.g. Algolia) would replace
 * this if that ever stops being true.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ issues: [] });

  const accessibleProjectIds = await getAccessibleProjectIds(user.id);
  if (accessibleProjectIds.length === 0) return NextResponse.json({ issues: [] });

  const snap = await adminDb
    .collection("issues")
    .where("projectId", "in", accessibleProjectIds.slice(0, 30))
    .orderBy("updatedAt", "desc")
    .limit(200)
    .get();

  const qLower = q.toLowerCase();
  const projectIds = [...new Set(snap.docs.map((d) => d.data().projectId as string))];
  const projectSnaps = projectIds.length
    ? await adminDb.getAll(...projectIds.map((id) => adminDb.doc(`projects/${id}`)))
    : [];
  const projectById = new Map(projectSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()!]));

  const issues = snap.docs
    .filter((d) => d.data().title.toLowerCase().includes(qLower) || d.data().key.toLowerCase().includes(qLower))
    .slice(0, 8)
    .map((d) => {
      const data = d.data();
      const project = projectById.get(data.projectId);
      return {
        id: d.id,
        key: data.key,
        title: data.title,
        project: project ? { key: project.key, name: project.name } : null,
      };
    });

  return NextResponse.json({ issues });
}
