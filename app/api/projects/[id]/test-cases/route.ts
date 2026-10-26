import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { tsToISO } from "@/lib/firebase/firestore-utils";
import { getSessionUser } from "@/lib/auth";
import { errorResponse, forbidden, notFound, unauthorized, zodErrorResponse } from "@/lib/http";
import { hasProjectPermission, isProjectMember } from "@/lib/permissions";

/**
 * A test case IS an issue (issueType "Caso de Prueba") plus a testCases/{id}
 * doc holding the Xray-specific fields — the testCases doc id is the same
 * as the issue id (they're 1:1, so no separate id is needed).
 */
const stepSchema = z.object({
  step: z.string().trim().min(1).max(2000),
  expectedResult: z.string().trim().max(2000).optional(),
});

const createTestCaseSchema = z.object({
  title: z.string().trim().min(1).max(255),
  preconditions: z.string().trim().max(5000).optional(),
  steps: z.array(stepSchema).default([]),
  requirementIds: z.array(z.string().min(1)).optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await isProjectMember(user.id, projectId))) return forbidden();

  const snap = await adminDb.collection("testCases").where("projectId", "==", projectId).get();
  const testCases = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        issue: data.issue,
        requirements: (data.requirements ?? []) as { issue: { id: string; key: string; title: string } }[],
        runs: [{ status: data.lastRunStatus ?? "NOT_RUN" }],
        createdAt: tsToISO(data.createdAt),
      };
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({ testCases });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id: projectId } = await params;

  if (!(await hasProjectPermission(user.id, projectId, "testing.manage"))) return forbidden();

  const projectSnap = await adminDb.doc(`projects/${projectId}`).get();
  if (!projectSnap.exists) return notFound("Proyecto");
  const project = projectSnap.data()!;

  const parsed = createTestCaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { title, preconditions, steps, requirementIds } = parsed.data;

  const issueTypeSnap = await adminDb
    .collection(`projects/${projectId}/issueTypes`)
    .where("name", "==", "Caso de Prueba")
    .limit(1)
    .get();
  if (issueTypeSnap.empty) {
    return errorResponse(500, "El proyecto no tiene el tipo 'Caso de Prueba' configurado");
  }
  const issueType = issueTypeSnap.docs[0];

  const statuses = (project.workflow?.statuses ?? []) as { id: string; isInitial?: boolean }[];
  const initialStatus = statuses.find((s) => s.isInitial) ?? statuses[0];
  if (!initialStatus) return errorResponse(500, "El proyecto no tiene un flujo de trabajo válido");

  let requirements: { issue: { id: string; key: string; title: string } }[] = [];
  if (requirementIds && requirementIds.length > 0) {
    const reqSnaps = await adminDb.getAll(...requirementIds.map((id) => adminDb.doc(`issues/${id}`)));
    if (reqSnaps.some((s) => !s.exists || s.data()!.projectId !== projectId)) {
      return errorResponse(400, "Alguno de los requisitos no pertenece a este proyecto");
    }
    requirements = reqSnaps.map((s) => ({
      issue: { id: s.id, key: s.data()!.key, title: s.data()!.title },
    }));
  }

  const [reporterSnap] = await Promise.all([adminDb.doc(`users/${user.id}`).get()]);
  const issueRef = adminDb.collection("issues").doc();

  await adminDb.runTransaction(async (tx) => {
    const freshProject = await tx.get(adminDb.doc(`projects/${projectId}`));
    const number = (freshProject.data()!.issueCounter ?? 0) + 1;
    tx.update(adminDb.doc(`projects/${projectId}`), { issueCounter: number });

    const issueData = {
      organizationId: project.organizationId,
      projectId,
      number,
      key: `${project.key}-${number}`,
      issueTypeId: issueType.id,
      issueType: { id: issueType.id, name: issueType.data().name, color: issueType.data().color ?? null },
      title,
      description: null,
      priority: "MEDIUM",
      statusId: initialStatus.id,
      status: initialStatus,
      assigneeId: null,
      assignee: null,
      reporterId: user.id,
      reporter: {
        id: user.id,
        name: reporterSnap.data()?.name ?? null,
        email: reporterSnap.data()?.email,
        avatarUrl: reporterSnap.data()?.avatarUrl ?? null,
      },
      parentId: null,
      sprintId: null,
      storyPoints: null,
      dueDate: null,
      labels: [],
      childCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(issueRef, issueData);
    tx.set(adminDb.doc(`testCases/${issueRef.id}`), {
      projectId,
      preconditions: preconditions ?? null,
      steps,
      requirements,
      lastRunStatus: "NOT_RUN",
      issue: { id: issueRef.id, key: issueData.key, title },
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  const created = await adminDb.doc(`testCases/${issueRef.id}`).get();
  const data = created.data()!;
  return NextResponse.json(
    {
      testCase: {
        id: issueRef.id,
        preconditions: data.preconditions,
        steps: data.steps,
        issue: data.issue,
        requirements: data.requirements,
      },
    },
    { status: 201 },
  );
}
