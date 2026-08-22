import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";

/**
 * The file itself is uploaded directly from the browser to the Supabase
 * Storage "attachments" bucket (see lib/supabase/storage.ts) — this route
 * only persists the resulting metadata, keeping large payloads off our
 * server/serverless functions.
 */
const createAttachmentSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  fileUrl: z.string().url(),
  fileSize: z.number().int().min(0),
  mimeType: z.string().trim().min(1).max(127),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({ where: { id }, select: { projectId: true } });
  if (!issue) return notFound("Incidencia");
  if (!(await isProjectMember(user.id, issue.projectId))) return forbidden();

  const parsed = createAttachmentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const attachment = await prisma.attachment.create({
    data: { issueId: id, uploaderId: user.id, ...parsed.data },
  });

  return NextResponse.json({ attachment }, { status: 201 });
}
