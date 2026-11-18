import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/issue-service";
import {
  restoreComment,
  restoreIssue,
  restoreTestCase,
  softDeleteComment,
  softDeleteIssue,
  softDeleteTestCase,
} from "@/lib/trash-service";
import { loadProjectTrash } from "@/lib/trash-queries";

/** F0-8 contra la base real: borrado lógico, restauración y papelera. */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("borrado lógico y papelera", () => {
  let orgId: string;
  let projectId: string;
  let userId: string;
  let typeId: string;
  let statusId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { id: `tr-${suffix}`, email: `tr-${suffix}@test.local` } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: "TR", slug: `tr-${suffix}` } });
    orgId = org.id;
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    statusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    const project = await prisma.project.create({ data: { key: "TR", name: "TR", organizationId: orgId, workflowId: wf.id } });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  let n = 0;
  async function issue(title: string, parentId?: string) {
    n += 1;
    return prisma.issue.create({
      data: {
        key: `TR-${n}`, number: n, title, projectId, issueTypeId: typeId, statusId,
        reporterId: userId, parentId: parentId ?? null,
      },
    });
  }

  it("borrar una incidencia la oculta de consultas normales, junto con sus subtareas", async () => {
    const parent = await issue("padre");
    const child = await issue("hija", parent.id);
    await prisma.comment.create({ data: { issueId: parent.id, authorId: userId, body: "nota" } });

    const result = await softDeleteIssue(parent.id);
    expect(result.deleted).toBe(2);

    expect(await prisma.issue.findUnique({ where: { id: parent.id } })).toBeNull();
    expect(await prisma.issue.findUnique({ where: { id: child.id } })).toBeNull();
    const visible = await prisma.issue.findMany({ where: { projectId } });
    expect(visible.some((i) => i.id === parent.id || i.id === child.id)).toBe(false);
  });

  it("la papelera muestra la incidencia borrada; la subtarea aparece con su padre, no sola", async () => {
    const trash = await loadProjectTrash(projectId, userId);
    const titles = trash.issues.map((i) => i.title);
    expect(titles).toContain("padre");
    expect(titles).not.toContain("hija");
  });

  it("restaurar devuelve la incidencia, sus subtareas y sus comentarios", async () => {
    const parent = await prisma.issue.findFirstOrThrow({
      where: { projectId, title: "padre", deletedAt: { not: null } },
    });
    const restored = await restoreIssue(parent.id);
    expect(restored.restored).toBe(2);

    expect(await prisma.issue.findUnique({ where: { id: parent.id } })).not.toBeNull();
    const child = await prisma.issue.findFirstOrThrow({ where: { parentId: parent.id } });
    expect(child.deletedAt).toBeNull();
    const comments = await prisma.comment.findMany({ where: { issueId: parent.id } });
    expect(comments).toHaveLength(1);
  });

  it("no se puede restaurar una subtarea mientras su padre sigue en la papelera", async () => {
    const parent = await issue("padre2");
    const child = await issue("hija2", parent.id);
    await softDeleteIssue(parent.id);

    // La hija está en la papelera junto al padre: restaurarla sola daría una
    // incidencia visible sin su padre, así que se rechaza con 409.
    const err = await restoreIssue(child.id).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.status).toBe(409);

    await restoreIssue(parent.id);
    expect((await prisma.issue.findUnique({ where: { id: child.id } }))?.deletedAt).toBeNull();
  });

  it("un comentario borrado desaparece de las consultas y se restaura", async () => {
    const target = await issue("con comentario");
    const c = await prisma.comment.create({ data: { issueId: target.id, authorId: userId, body: "borrame" } });

    await softDeleteComment(c.id);
    expect(await prisma.comment.findMany({ where: { issueId: target.id } })).toHaveLength(0);

    await restoreComment(c.id);
    expect(await prisma.comment.findMany({ where: { issueId: target.id } })).toHaveLength(1);
  });

  it("un caso de prueba borrado no aparece y se restaura", async () => {
    const tIssue = await issue("caso");
    const tc = await prisma.testCase.create({ data: { issueId: tIssue.id, steps: [] } });

    await softDeleteTestCase(tc.id);
    expect(await prisma.testCase.findUnique({ where: { id: tc.id } })).toBeNull();

    await restoreTestCase(tc.id);
    expect(await prisma.testCase.findUnique({ where: { id: tc.id } })).not.toBeNull();
  });
});
