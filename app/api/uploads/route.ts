import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";
import { ATTACHMENTS_BUCKET, MURAL_BUCKET, uploadToBucket } from "@/lib/supabase/storage-server";

const MAX_BYTES = 10 * 1024 * 1024;
const scopeSchema = z.enum(["issue", "mural"]);

/**
 * Sube un archivo a almacenamiento tras comprobar que quien sube es miembro
 * del proyecto al que pertenece la incidencia o el tablero.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Envía un formulario con file, scope e id" }, { status: 400 });

  const scope = scopeSchema.safeParse(form.get("scope"));
  const targetId = String(form.get("id") ?? "");
  const file = form.get("file");
  if (!scope.success || !targetId || !(file instanceof File)) {
    return NextResponse.json({ error: "Faltan file, scope o id" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "El archivo está vacío" }, { status: 422 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera 10 MB" }, { status: 422 });

  let projectId: string | null = null;
  if (scope.data === "issue") {
    projectId = (await prisma.issue.findUnique({ where: { id: targetId }, select: { projectId: true } }))?.projectId ?? null;
  } else {
    projectId = (await prisma.board.findUnique({ where: { id: targetId }, select: { projectId: true } }))?.projectId ?? null;
  }
  if (!projectId) return notFound(scope.data === "issue" ? "Incidencia" : "Tablero");
  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  try {
    const bucket = scope.data === "issue" ? ATTACHMENTS_BUCKET : MURAL_BUCKET;
    const uploaded = await uploadToBucket(bucket, targetId, file);
    return NextResponse.json(uploaded, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
