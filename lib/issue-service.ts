import { z } from "zod";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { notify } from "@/lib/notifications";
import { PRIORITY_LABEL } from "@/lib/priority";

/**
 * Shared issue create/update logic used by both the session-based routes
 * (app/api/issues/**) and the public API (app/api/v1/**), so the two never
 * drift out of sync on validation, workflow rules, or activity logging.
 *
 * issueType/status/assignee/reporter are denormalized onto the issue
 * document (no joins in Firestore) — issueType and reporter are a
 * point-in-time snapshot taken at creation, status is refreshed on every
 * transition (see transitionIssue below), and assignee is refreshed
 * whenever it changes here.
 */
export class ServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type UserSnapshot = { id: string; name: string | null; email: string; avatarUrl: string | null };

function snapshotUser(id: string, data: FirebaseFirestore.DocumentData): UserSnapshot {
  return { id, name: data.name ?? null, email: data.email, avatarUrl: data.avatarUrl ?? null };
}

export const createIssueInput = z.object({
  projectId: z.string().min(1),
  issueTypeId: z.string().min(1),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(10000).optional(),
  priority: z.enum(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"]).optional(),
  assigneeId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  sprintId: z.string().min(1).optional(),
  storyPoints: z.number().int().min(0).max(999).optional(),
  dueDate: z.string().datetime().optional(),
});

export async function createIssue(reporterId: string, data: z.infer<typeof createIssueInput>) {
  const projectRef = adminDb.doc(`projects/${data.projectId}`);
  const [projectSnap, issueTypeSnap, reporterSnap, assigneeSnap] = await Promise.all([
    projectRef.get(),
    adminDb.doc(`projects/${data.projectId}/issueTypes/${data.issueTypeId}`).get(),
    adminDb.doc(`users/${reporterId}`).get(),
    data.assigneeId ? adminDb.doc(`users/${data.assigneeId}`).get() : Promise.resolve(null),
  ]);
  if (!projectSnap.exists) throw new ServiceError(404, "Proyecto no encontrado");
  if (!issueTypeSnap.exists) throw new ServiceError(400, "Tipo de incidencia inválido para este proyecto");
  const project = projectSnap.data()!;
  const issueType = issueTypeSnap.data()!;

  const statuses = (project.workflow?.statuses ?? []) as { id: string; isInitial?: boolean }[];
  const initialStatus = statuses.find((s) => s.isInitial) ?? statuses[0];
  if (!initialStatus) throw new ServiceError(500, "El proyecto no tiene un flujo de trabajo válido");

  const issueRef = adminDb.collection("issues").doc();

  await adminDb.runTransaction(async (tx) => {
    const freshProject = await tx.get(projectRef);
    const number = (freshProject.data()!.issueCounter ?? 0) + 1;
    tx.update(projectRef, { issueCounter: number });
    tx.set(issueRef, {
      organizationId: project.organizationId,
      projectId: data.projectId,
      number,
      key: `${project.key}-${number}`,
      issueTypeId: data.issueTypeId,
      issueType: { id: data.issueTypeId, name: issueType.name, color: issueType.color ?? null },
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? "MEDIUM",
      statusId: initialStatus.id,
      status: initialStatus,
      assigneeId: data.assigneeId ?? null,
      assignee:
        data.assigneeId && assigneeSnap?.exists ? snapshotUser(data.assigneeId, assigneeSnap.data()!) : null,
      reporterId,
      reporter: snapshotUser(reporterId, reporterSnap.data() ?? {}),
      parentId: data.parentId ?? null,
      sprintId: data.sprintId ?? null,
      storyPoints: data.storyPoints ?? null,
      dueDate: data.dueDate ? Timestamp.fromDate(new Date(data.dueDate)) : null,
      labels: [],
      childCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  if (data.parentId) {
    adminDb.doc(`issues/${data.parentId}`).update({ childCount: FieldValue.increment(1) }).catch(() => {});
  }

  const created = await issueRef.get();
  return { id: issueRef.id, ...created.data() };
}

export const updateIssueInput = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(10000).nullable().optional(),
  priority: z.enum(["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"]).optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  sprintId: z.string().min(1).nullable().optional(),
  storyPoints: z.number().int().min(0).max(999).nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export async function updateIssue(
  actorId: string,
  issueId: string,
  data: z.infer<typeof updateIssueInput>,
) {
  const ref = adminDb.doc(`issues/${issueId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new ServiceError(404, "Incidencia no encontrada");
  const existing = snap.data()!;

  const { dueDate, assigneeId, sprintId, ...rest } = data;
  const updates: Record<string, unknown> = { ...rest, updatedAt: FieldValue.serverTimestamp() };

  let newAssignee: UserSnapshot | null = existing.assignee ?? null;
  if (assigneeId !== undefined) {
    updates.assigneeId = assigneeId;
    newAssignee = null;
    if (assigneeId) {
      const uSnap = await adminDb.doc(`users/${assigneeId}`).get();
      if (uSnap.exists) newAssignee = snapshotUser(assigneeId, uSnap.data()!);
    }
    updates.assignee = newAssignee;
  }

  let existingSprintName: string | null = null;
  let newSprintName: string | null = null;
  if (sprintId !== undefined) {
    updates.sprintId = sprintId;
    const [existingSprintSnap, newSprintSnap] = await Promise.all([
      existing.sprintId ? adminDb.doc(`projects/${existing.projectId}/sprints/${existing.sprintId}`).get() : null,
      sprintId ? adminDb.doc(`projects/${existing.projectId}/sprints/${sprintId}`).get() : null,
    ]);
    existingSprintName = existingSprintSnap?.exists ? existingSprintSnap.data()!.name : null;
    newSprintName = newSprintSnap?.exists ? newSprintSnap.data()!.name : null;
  }

  if (dueDate !== undefined) {
    updates.dueDate = dueDate ? Timestamp.fromDate(new Date(dueDate)) : null;
  }

  await ref.update(updates);

  if (assigneeId && assigneeId !== existing.assigneeId) {
    await notify({
      userId: assigneeId,
      actorId,
      type: "ISSUE_ASSIGNED",
      title: `Te asignaron ${existing.key}`,
      body: existing.title,
      link: `/issues/${issueId}`,
    });
  }

  const activities: { field: string; fromLabel: string | null; toLabel: string | null }[] = [];
  if (rest.priority && rest.priority !== existing.priority) {
    activities.push({
      field: "priority",
      fromLabel: PRIORITY_LABEL[existing.priority as keyof typeof PRIORITY_LABEL],
      toLabel: PRIORITY_LABEL[rest.priority as keyof typeof PRIORITY_LABEL],
    });
  }
  if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
    activities.push({
      field: "assignee",
      fromLabel: existing.assignee ? (existing.assignee.name ?? existing.assignee.email) : "Sin asignar",
      toLabel: newAssignee ? (newAssignee.name ?? newAssignee.email) : "Sin asignar",
    });
  }
  if (sprintId !== undefined && sprintId !== existing.sprintId) {
    activities.push({
      field: "sprint",
      fromLabel: existingSprintName ?? "Backlog",
      toLabel: newSprintName ?? "Backlog",
    });
  }
  if (activities.length > 0) {
    const actorSnap = await adminDb.doc(`users/${actorId}`).get();
    const actor = actorSnap.exists ? snapshotUser(actorId, actorSnap.data()!) : null;
    const batch = adminDb.batch();
    for (const a of activities) {
      batch.set(adminDb.collection(`issues/${issueId}/activity`).doc(), {
        ...a,
        actorId,
        actor,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  const updated = await ref.get();
  return { id: issueId, ...updated.data() };
}
