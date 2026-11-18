import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission } from "@/lib/permissions";
import { bulkInput, permissionFor, runBulk } from "@/lib/bulk-service";

/** Edición masiva de incidencias de un proyecto (F1-4). Responde por cada incidencia. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  const parsed = bulkInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  if (!(await hasProjectPermission(user.id, projectId, permissionFor(parsed.data.action)))) return forbidden();

  const results = await runBulk(user.id, projectId, parsed.data.issueIds, parsed.data.action);
  return NextResponse.json({
    total: results.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
