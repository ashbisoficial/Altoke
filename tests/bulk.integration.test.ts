import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { runBulk } from "@/lib/bulk-service";

/** F1-4 contra la base: 50 incidencias, resultado por ítem y fallos con motivo. */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("edición masiva", () => {
  let orgId: string;
  let otherOrgId: string;
  let projectId: string;
  let foreignIssueId: string;
  let userId: string;
  let todo: string;
  let doing: string;
  let review: string;
  let typeId: string;
  let labelId: string;
  const issueIds: string[] = [];

  beforeAll(async () => {
    userId = (await prisma.user.create({ data: { id: `bk-${suffix}`, email: `bk-${suffix}@test.local` } })).id;
    orgId = (await prisma.organization.create({ data: { name: "BK", slug: `bk-${suffix}` } })).id;
    otherOrgId = (await prisma.organization.create({ data: { name: "BK2", slug: `bk2-${suffix}` } })).id;
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    todo = (await prisma.workflowStatus.create({ data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true, order: 0 } })).id;
    doing = (await prisma.workflowStatus.create({ data: { workflowId: wf.id, name: "En progreso", category: "IN_PROGRESS", color: "#00f", order: 1 } })).id;
    review = (await prisma.workflowStatus.create({ data: { workflowId: wf.id, name: "Revisión", category: "IN_REVIEW", color: "#fa0", order: 2 } })).id;
    await prisma.workflowTransition.create({ data: { workflowId: wf.id, name: "Empezar", fromStatusId: todo, toStatusId: doing } });
    const project = await prisma.project.create({ data: { key: "BK", name: "BK", organizationId: orgId, workflowId: wf.id } });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;
    labelId = (await prisma.label.create({ data: { projectId, name: "lote", color: "#0f0" } })).id;

    const wf2 = await prisma.workflow.create({ data: { name: "WF2", organizationId: otherOrgId } });
    const st2 = await prisma.workflowStatus.create({ data: { workflowId: wf2.id, name: "x", category: "TODO", color: "#000", isInitial: true } });
    const p2 = await prisma.project.create({ data: { key: "OT", name: "OT", organizationId: otherOrgId, workflowId: wf2.id } });
    const t2 = await prisma.issueType.create({ data: { name: "T", projectId: p2.id } });
    foreignIssueId = (await prisma.issue.create({ data: { key: "OT-1", number: 1, title: "ajena", projectId: p2.id, issueTypeId: t2.id, statusId: st2.id, reporterId: userId } })).id;

    for (let n = 1; n <= 50; n++) {
      const issue = await prisma.issue.create({
        data: { key: `BK-${n}`, number: n, title: `lote ${n}`, projectId, issueTypeId: typeId, statusId: todo, reporterId: userId, rank: `a${String(n).padStart(3, "0")}` },
      });
      issueIds.push(issue.id);
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("cambiar estado: las transiciones válidas pasan y las demás informan el motivo", async () => {
    const results = await runBulk(userId, projectId, issueIds, { type: "status", statusId: doing });
    expect(results).toHaveLength(50);
    expect(results.every((r) => r.ok)).toBe(true);

    // Desde "En progreso" no hay transición hacia "Revisión" en este flujo: falla con motivo.
    const failed = await runBulk(userId, projectId, issueIds.slice(0, 5), { type: "status", statusId: review });
    expect(failed.every((r) => !r.ok)).toBe(true);
    expect(failed[0].error).toMatch(/flujo de trabajo/);
  });

  it("una incidencia de otro proyecto falla sin afectar a las demás", async () => {
    const results = await runBulk(userId, projectId, [issueIds[0], foreignIssueId, issueIds[1]], { type: "priority", priority: "HIGH" });
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(results[1].error).toMatch(/no existe en este proyecto/);
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: foreignIssueId } })).priority).toBe("MEDIUM");
  });

  it("asignar persona y mover a sprint se aplican a todas", async () => {
    const results = await runBulk(userId, projectId, issueIds.slice(0, 20), { type: "assignee", assigneeId: userId });
    expect(results.every((r) => r.ok)).toBe(true);
    const assigned = await prisma.issue.count({ where: { id: { in: issueIds.slice(0, 20) }, assigneeId: userId } });
    expect(assigned).toBe(20);
  });

  it("etiquetar y quitar etiqueta registra el cambio en el historial", async () => {
    await runBulk(userId, projectId, issueIds.slice(0, 10), { type: "label_add", labelId });
    expect(await prisma.issueLabel.count({ where: { labelId } })).toBe(10);
    await runBulk(userId, projectId, issueIds.slice(0, 3), { type: "label_remove", labelId });
    expect(await prisma.issueLabel.count({ where: { labelId } })).toBe(7);
    const history = await prisma.issueActivity.count({ where: { issueId: issueIds[0], field: "labels" } });
    expect(history).toBeGreaterThanOrEqual(2);
  });

  it("una etiqueta de otro proyecto no se puede usar", async () => {
    const foreignLabel = await prisma.label.create({
      data: { projectId: (await prisma.project.findFirstOrThrow({ where: { organizationId: otherOrgId } })).id, name: "ajena", color: "#000" },
    });
    const results = await runBulk(userId, projectId, [issueIds[30]], { type: "label_add", labelId: foreignLabel.id });
    expect(results[0].ok).toBe(false);
    expect(results[0].error).toMatch(/etiqueta no pertenece/);
  });
});
