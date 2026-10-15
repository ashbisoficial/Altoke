import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getApiUser } from "@/lib/api-auth";
import { forbidden, unauthorized } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const snap = await adminDb.collection(`projects/${projectId}/issueTypes`).get();
  const issueTypes = snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name, color: data.color ?? null, isSubtask: Boolean(data.isSubtask) };
  });

  return NextResponse.json({ issueTypes });
}
