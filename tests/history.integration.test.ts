import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { labelNamesOf, recordLabelChange, updateIssue } from "@/lib/issue-service";

/** F0-9 contra la base real: cada cambio de título, descripción, fecha y etiquetas queda registrado. */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("historial ampliado", () => {
  let orgId: string;
  let projectId: string;
  let userId: string;
  let issueId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { id: `hs-${suffix}`, email: `hs-${suffix}@test.local` } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: "HS", slug: `hs-${suffix}` } });
    orgId = org.id;
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    const statusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    const project = await prisma.project.create({ data: { key: "HS", name: "HS", organizationId: orgId, workflowId: wf.id } });
    projectId = project.id;
    const typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;
    issueId = (await prisma.issue.create({
      data: { key: "HS-1", number: 1, title: "Original", description: "uno", projectId, issueTypeId: typeId, statusId, reporterId: userId },
    })).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("registra título, descripción y fecha con valor anterior y nuevo", async () => {
    await updateIssue(userId, issueId, {
      title: "Nuevo título",
      description: "dos",
      dueDate: "2026-12-01T00:00:00.000Z",
    });
    const rows = await prisma.issueActivity.findMany({ where: { issueId }, orderBy: { createdAt: "asc" } });
    const byField = Object.fromEntries(rows.map((r) => [r.field, r]));
    expect(byField.title).toMatchObject({ fromLabel: "Original", toLabel: "Nuevo título" });
    expect(byField.description).toMatchObject({ fromLabel: "uno", toLabel: "dos" });
    expect(byField.dueDate).toMatchObject({ fromLabel: "Sin fecha", toLabel: "2026-12-01" });
  });

  it("un cambio que no altera el valor no genera historial", async () => {
    const before = await prisma.issueActivity.count({ where: { issueId } });
    await updateIssue(userId, issueId, { title: "Nuevo título", description: "dos" });
    expect(await prisma.issueActivity.count({ where: { issueId } })).toBe(before);
  });

  it("registra etiquetas con el conjunto anterior y el nuevo", async () => {
    const bug = await prisma.label.create({ data: { projectId, name: "bug", color: "#f00" } });
    const ui = await prisma.label.create({ data: { projectId, name: "ui", color: "#0f0" } });

    const b0 = await labelNamesOf(issueId);
    await prisma.issueLabel.create({ data: { issueId, labelId: bug.id } });
    await recordLabelChange(userId, issueId, b0, await labelNamesOf(issueId));

    const b1 = await labelNamesOf(issueId);
    await prisma.issueLabel.create({ data: { issueId, labelId: ui.id } });
    await recordLabelChange(userId, issueId, b1, await labelNamesOf(issueId));

    const labelRows = await prisma.issueActivity.findMany({
      where: { issueId, field: "labels" },
      orderBy: { createdAt: "asc" },
    });
    expect(labelRows.at(0)).toMatchObject({ fromLabel: "Sin etiquetas", toLabel: "bug" });
    expect(labelRows.at(1)).toMatchObject({ fromLabel: "bug", toLabel: "bug, ui" });
  });
});
