import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { createIssue, updateIssue, ServiceError } from "@/lib/issue-service";

const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => session.user }));
import { DELETE as deleteField } from "@/app/api/custom-fields/[id]/route";

/** F1-2 contra la base: valores en Issue.customFields, reglas de servicio y borrado en cascada. */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("campos personalizados contra la base", () => {
  let orgId: string;
  let otherOrgId: string;
  let projectId: string;
  let userId: string;
  let outsiderId: string;
  let typeId: string;
  let statusId: string;
  let envField: string;
  let sevField: string;

  beforeAll(async () => {
    userId = (await prisma.user.create({ data: { id: `cf-${suffix}`, email: `cf-${suffix}@test.local` } })).id;
    outsiderId = (await prisma.user.create({ data: { id: `cfo-${suffix}`, email: `cfo-${suffix}@test.local` } })).id;
    const org = await prisma.organization.create({ data: { name: "CF", slug: `cf-${suffix}` } });
    orgId = org.id;
    const other = await prisma.organization.create({ data: { name: "CF2", slug: `cf2-${suffix}` } });
    otherOrgId = other.id;
    const role = await prisma.role.create({ data: { name: "Member", scope: "ORGANIZATION", organizationId: orgId } });
    const manage = await prisma.permission.upsert({
      where: { key: "project.manage" }, update: {}, create: { key: "project.manage", description: "Editar proyecto" },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: manage.id } });
    await prisma.membership.create({ data: { userId, organizationId: orgId, roleId: role.id } });
    const roleOther = await prisma.role.create({ data: { name: "Member", scope: "ORGANIZATION", organizationId: otherOrgId } });
    await prisma.membership.create({ data: { userId: outsiderId, organizationId: otherOrgId, roleId: roleOther.id } });

    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    statusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    const project = await prisma.project.create({ data: { key: "CF", name: "CF", organizationId: orgId, workflowId: wf.id } });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;

    envField = (await prisma.customField.create({
      data: { projectId, name: "Entorno", type: "TEXT", required: true, position: 0 },
    })).id;
    sevField = (await prisma.customField.create({
      data: { projectId, name: "Severidad", type: "SELECT", options: ["baja", "alta"], position: 1 },
    })).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, outsiderId] } } });
    await prisma.$disconnect();
  });

  it("crear sin el campo obligatorio devuelve 422 señalando el campo", async () => {
    const err = await createIssue(userId, { projectId, issueTypeId: typeId, title: "sin entorno" }).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.status).toBe(422);
    expect(err.fields.Entorno).toEqual(["Es obligatorio"]);
  });

  it("crear con valores válidos los guarda por id del campo", async () => {
    const issue = await createIssue(userId, {
      projectId, issueTypeId: typeId, title: "con campos",
      customFields: { [envField]: "staging", [sevField]: "alta" },
    });
    const row = await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(row.customFields).toEqual({ [envField]: "staging", [sevField]: "alta" });
  });

  it("editar cambia solo los campos del parche", async () => {
    const issue = await prisma.issue.findFirstOrThrow({ where: { projectId, title: "con campos" } });
    await updateIssue(userId, issue.id, { customFields: { [sevField]: "baja" } });
    const row = await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } });
    expect(row.customFields).toEqual({ [envField]: "staging", [sevField]: "baja" });
  });

  it("un usuario de otra organización no puede ser valor de un campo USER", async () => {
    const userField = await prisma.customField.create({
      data: { projectId, name: "Revisor", type: "USER", position: 2 },
    });
    const issue = await prisma.issue.findFirstOrThrow({ where: { projectId, title: "con campos" } });
    const err = await updateIssue(userId, issue.id, { customFields: { [userField.id]: outsiderId } }).catch((e) => e);
    expect(err.status).toBe(422);
    expect(err.fields.Revisor).toBeDefined();

    await updateIssue(userId, issue.id, { customFields: { [userField.id]: userId } });
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: issue.id } })).customFields).toMatchObject({ [userField.id]: userId });
  });

  it("borrar un campo quita su valor de todas las incidencias del proyecto", async () => {
    session.user = { id: userId };
    const res = await deleteField(new NextRequest(`http://localhost/api/custom-fields/${sevField}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: sevField }),
    });
    expect(res.status).toBe(200);

    const rows = await prisma.issue.findMany({ where: { projectId }, select: { customFields: true } });
    expect(rows.every((r) => !(sevField in (r.customFields as Record<string, unknown>)))).toBe(true);
    expect(rows.some((r) => envField in (r.customFields as Record<string, unknown>))).toBe(true);
  });
});
