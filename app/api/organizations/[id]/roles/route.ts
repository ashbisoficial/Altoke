import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/http";
import { isOrgMember } from "@/lib/permissions";
import { DEFAULT_ROLES } from "@/lib/seed-defaults";

/**
 * Roles are the fixed Admin/Member/Viewer set, not per-organization rows
 * anymore (no custom roles ever existed in the UI) — id === name so every
 * client that was passing a Prisma roleId along keeps working unchanged.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: organizationId } = await params;

  if (!(await isOrgMember(user.id, organizationId))) return forbidden();

  const roles = Object.keys(DEFAULT_ROLES).map((name) => ({ id: name, name }));
  return NextResponse.json({ roles });
}
