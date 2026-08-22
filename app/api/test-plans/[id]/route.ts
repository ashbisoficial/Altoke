import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { forbidden, notFound, unauthorized } from "@/lib/http";
import { isProjectMember } from "@/lib/permissions";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const testPlan = await prisma.testPlan.findUnique({
    where: { id },
    include: {
      sprint: { select: { id: true, name: true } },
      cases: {
        include: {
          testCase: { include: { issue: { select: { id: true, key: true, title: true } } } },
        },
      },
      executions: {
        include: {
          runs: {
            include: { executedBy: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!testPlan) return notFound("Plan de pruebas");
  if (!(await isProjectMember(user.id, testPlan.projectId))) return forbidden();

  return NextResponse.json({ testPlan });
}
