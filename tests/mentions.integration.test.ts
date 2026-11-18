import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateIssue } from "@/lib/issue-service";
import { notifyMentions } from "@/lib/mentions-service";

/** F1-1 contra la base: una mención genera una notificación; editar no vuelve a avisar. */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("menciones generan notificaciones", () => {
  let orgId: string;
  let projectId: string;
  let issueId: string;
  let author: string;
  let ana: string;

  beforeAll(async () => {
    const mk = (id: string, name: string) => prisma.user.create({ data: { id: `${id}-${suffix}`, email: `${id}-${suffix}@test.local`, name } });
    author = (await mk("mauth", "Autora")).id;
    ana = (await mk("mana", "Ana Pérez")).id;
    const org = await prisma.organization.create({ data: { name: "MN", slug: `mn-${suffix}` } });
    orgId = org.id;
    const role = await prisma.role.create({ data: { name: "Member", scope: "ORGANIZATION", organizationId: orgId } });
    await prisma.membership.createMany({
      data: [
        { userId: author, organizationId: orgId, roleId: role.id },
        { userId: ana, organizationId: orgId, roleId: role.id },
      ],
    });
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    const statusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    const project = await prisma.project.create({ data: { key: "MN", name: "MN", organizationId: orgId, workflowId: wf.id } });
    projectId = project.id;
    const typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;
    issueId = (await prisma.issue.create({
      data: { key: "MN-1", number: 1, title: "Mencionados", projectId, issueTypeId: typeId, statusId, reporterId: author },
    })).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [author, ana] } } });
    await prisma.$disconnect();
  });

  it("un comentario que menciona a Ana le crea una notificación MENTIONED", async () => {
    await notifyMentions({
      actorId: author, issueId, projectId, issueKey: "MN-1", issueTitle: "Mencionados",
      text: "Revisa esto @anaperez por favor",
    });
    const rows = await prisma.notification.findMany({ where: { userId: ana, type: "MENTIONED" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].link).toBe(`/issues/${issueId}`);
  });

  it("editar una descripción no vuelve a avisar a quien ya estaba mencionado", async () => {
    await prisma.issue.update({ where: { id: issueId }, data: { description: "Antes @anaperez" } });
    await updateIssue(author, issueId, { description: "Antes @anaperez, ahora con más texto" });
    const rows = await prisma.notification.findMany({ where: { userId: ana, type: "MENTIONED" } });
    expect(rows).toHaveLength(1);
  });

  it("una mención nueva en la descripción sí notifica", async () => {
    const other = await prisma.user.create({ data: { id: `mother-${suffix}`, email: `mother-${suffix}@test.local`, name: "Otra" } });
    await prisma.membership.create({
      data: { userId: other.id, organizationId: orgId, roleId: (await prisma.role.findFirstOrThrow({ where: { organizationId: orgId } })).id },
    });
    await updateIssue(author, issueId, { description: "Ahora también @otra" });
    const rows = await prisma.notification.findMany({ where: { userId: other.id, type: "MENTIONED" } });
    expect(rows).toHaveLength(1);
    await prisma.user.delete({ where: { id: other.id } });
  });
});
