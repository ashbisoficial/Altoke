import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { forbidden, unauthorized } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";
import { loadProjectTrash } from "@/lib/trash-queries";

/** Papelera del proyecto: incidencias, casos de prueba y tus comentarios borrados. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;
  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  return NextResponse.json(await loadProjectTrash(projectId, user.id));
}
