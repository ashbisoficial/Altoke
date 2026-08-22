import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";
import { notify } from "@/lib/notifications";

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const issue = await prisma.issue.findUnique({
    where: { id },
    select: { projectId: true, key: true, title: true, assigneeId: true, reporterId: true },
  });
  if (!issue) return notFound("Incidencia");
  if (!(await isProjectMember(user.id, issue.projectId))) return forbidden();

  const parsed = createCommentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const comment = await prisma.comment.create({
    data: { issueId: id, authorId: user.id, body: parsed.data.body },
    include: { author: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });

  const notifyUserIds = new Set([issue.assigneeId, issue.reporterId].filter((v): v is string => !!v));
  for (const userId of notifyUserIds) {
    await notify({
      userId,
      actorId: user.id,
      type: "ISSUE_COMMENTED",
      title: `Nuevo comentario en ${issue.key}`,
      body: issue.title,
      link: `/issues/${id}`,
    });
  }

  return NextResponse.json({ comment }, { status: 201 });
}
