import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildIssueOrder, buildIssueWhere, parseListQuery, type FieldDefLite } from "@/lib/issue-query";

const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => session.user }));
import { GET as listSavedFilters, POST as saveFilter } from "@/app/api/projects/[id]/saved-filters/route";

/** F1-3 contra la base: filtros por URL, orden, campos personalizados y filtros guardados. */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("vista de lista contra la base", () => {
  let orgId: string;
  let projectId: string;
  let owner: string;
  let other: string;
  let outsider: string;
  let statusTodo: string;
  let statusDone: string;
  let typeId: string;
  let labelId: string;
  let numField: string;
  let multiField: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    owner = (await prisma.user.create({ data: { id: `ls-o-${suffix}`, email: `ls-o-${suffix}@test.local`, name: "Dueña" } })).id;
    other = (await prisma.user.create({ data: { id: `ls-x-${suffix}`, email: `ls-x-${suffix}@test.local`, name: "Otra" } })).id;
    outsider = (await prisma.user.create({ data: { id: `ls-n-${suffix}`, email: `ls-n-${suffix}@test.local` } })).id;
    const org = await prisma.organization.create({ data: { name: "LS", slug: `ls-${suffix}` } });
    orgId = org.id;
    const role = await prisma.role.create({ data: { name: "Member", scope: "ORGANIZATION", organizationId: orgId } });
    await prisma.membership.createMany({
      data: [
        { userId: owner, organizationId: orgId, roleId: role.id },
        { userId: other, organizationId: orgId, roleId: role.id },
      ],
    });
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    statusTodo = (await prisma.workflowStatus.create({ data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true, order: 0 } })).id;
    statusDone = (await prisma.workflowStatus.create({ data: { workflowId: wf.id, name: "Hecho", category: "DONE", color: "#0f0", order: 3 } })).id;
    const project = await prisma.project.create({ data: { key: "LS", name: "LS", organizationId: orgId, workflowId: wf.id } });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;
    labelId = (await prisma.label.create({ data: { projectId, name: "urgente", color: "#f00" } })).id;
    numField = (await prisma.customField.create({ data: { projectId, name: "Horas", type: "NUMBER", position: 0 } })).id;
    multiField = (await prisma.customField.create({ data: { projectId, name: "Módulos", type: "MULTI_SELECT", options: ["api", "ui"], position: 1 } })).id;

    const specs = [
      { key: "LS-1", title: "Login roto", statusId: statusTodo, assigneeId: owner, priority: "HIGH" as const, cf: { [numField]: 5, [multiField]: ["api"] }, label: true },
      { key: "LS-2", title: "Botón azul", statusId: statusDone, assigneeId: other, priority: "LOW" as const, cf: { [numField]: 2, [multiField]: ["ui", "api"] }, label: false },
      { key: "LS-3", title: "Sin dueño", statusId: statusTodo, assigneeId: null, priority: "MEDIUM" as const, cf: { [numField]: 8 }, label: false },
    ];
    for (let n = 0; n < specs.length; n++) {
      const s = specs[n];
      const issue = await prisma.issue.create({
        data: {
          key: s.key, number: n + 1, title: s.title, projectId, issueTypeId: typeId, statusId: s.statusId,
          assigneeId: s.assigneeId, priority: s.priority, reporterId: owner, rank: `a${n}`, customFields: s.cf,
        },
      });
      ids[s.key] = issue.id;
      if (s.label) await prisma.issueLabel.create({ data: { issueId: issue.id, labelId } });
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [owner, other, outsider] } } });
    await prisma.$disconnect();
  });

  // Se calculan después de beforeAll: los ids de campo no existen antes.
  const defsFor = (): FieldDefLite[] => [
    { id: numField, name: "Horas", type: "NUMBER", options: null },
    { id: multiField, name: "Módulos", type: "MULTI_SELECT", options: ["api", "ui"] },
  ];

  async function keysFor(qs: string) {
    const defs = defsFor();
    const q = parseListQuery(new URLSearchParams(qs), defs);
    const rows = await prisma.issue.findMany({
      where: buildIssueWhere(projectId, q, defs),
      orderBy: buildIssueOrder(q.sort),
      select: { key: true },
    });
    return rows.map((r) => r.key);
  }

  it("filtrar por estado devuelve solo esas incidencias", async () => {
    expect((await keysFor(`status=${statusTodo}`)).sort()).toEqual(["LS-1", "LS-3"]);
  });

  it("la búsqueda de texto encuentra por título y por clave", async () => {
    expect(await keysFor("q=azul")).toEqual(["LS-2"]);
    expect(await keysFor("q=ls-3")).toEqual(["LS-3"]);
  });

  it("'sin asignar' y 'backlog' se tratan como valores propios", async () => {
    expect(await keysFor("assignee=none")).toEqual(["LS-3"]);
  });

  it("la etiqueta filtra por relación", async () => {
    expect(await keysFor(`label=${labelId}`)).toEqual(["LS-1"]);
  });

  it("un campo NUMBER filtra por igualdad y MULTI_SELECT por pertenencia", async () => {
    expect(await keysFor(`cf.${numField}=8`)).toEqual(["LS-3"]);
    expect((await keysFor(`cf.${multiField}=api`)).sort()).toEqual(["LS-1", "LS-2"]);
  });

  it("el orden por clave usa el número y el orden por estado sigue el orden del flujo", async () => {
    expect(await keysFor("sort=-key")).toEqual(["LS-3", "LS-2", "LS-1"]);
    const byStatus = await keysFor("sort=status");
    expect(byStatus[byStatus.length - 1]).toBe("LS-2"); // "Hecho" tiene order 3
  });

  it("filtros guardados: compartidos los ve todo el proyecto; privados solo su dueño", async () => {
    session.user = { id: owner };
    const created = await saveFilter(
      new NextRequest(`http://localhost/api/projects/${projectId}/saved-filters`, {
        method: "POST",
        body: JSON.stringify({ name: "Mis bugs", query: "?status=x", shared: false }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(created.status).toBe(201);
    expect((await created.json()).filter.query).toBe("status=x");

    session.user = { id: other };
    const otherList = await listSavedFilters(new NextRequest(`http://localhost/api/projects/${projectId}/saved-filters`), {
      params: Promise.resolve({ id: projectId }),
    });
    expect((await otherList.json()).filters.map((f: { name: string }) => f.name)).not.toContain("Mis bugs");

    session.user = { id: outsider };
    const denied = await listSavedFilters(new NextRequest(`http://localhost/api/projects/${projectId}/saved-filters`), {
      params: Promise.resolve({ id: projectId }),
    });
    expect(denied.status).toBe(403);
  });
});
