import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import {
  errorBody,
  issueListResponse,
  issueResponse,
  issueTypeListResponse,
  projectListResponse,
  rankResponse,
} from "@/lib/api-v1-contract";
import { GET as listIssues, POST as createIssue } from "@/app/api/v1/projects/[id]/issues/route";
import { GET as listProjects } from "@/app/api/v1/projects/route";
import { GET as listIssueTypes } from "@/app/api/v1/projects/[id]/issue-types/route";
import { GET as getIssue, PATCH as patchIssue } from "@/app/api/v1/issues/[id]/route";
import { POST as rankIssue } from "@/app/api/v1/issues/[id]/rank/route";

/**
 * F0-5 contra la base real: las respuestas de la API v1 cumplen los esquemas
 * que la especificación OpenAPI declara. Si una ruta cambia la forma de su
 * respuesta sin actualizar el contrato, esta prueba falla.
 */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("respuestas reales cumplen el contrato v1", () => {
  let orgId: string;
  let projectId: string;
  let userId: string;
  let typeId: string;
  let statusId: string;
  let key: string;
  let firstIssueId: string;
  let secondIssueId: string;

  const auth = (extra: Record<string, string> = {}) => ({ authorization: `Bearer ${key}`, ...extra });

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { id: `ct-${suffix}`, email: `ct-${suffix}@test.local` } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: "CT", slug: `ct-${suffix}` } });
    orgId = org.id;
    const role = await prisma.role.create({ data: { name: "Member", scope: "ORGANIZATION", organizationId: orgId } });
    const perm = await prisma.permission.upsert({
      where: { key: "issue.create" }, update: {}, create: { key: "issue.create", description: "Crear incidencias" },
    });
    const editPerm = await prisma.permission.upsert({
      where: { key: "issue.edit" }, update: {}, create: { key: "issue.edit", description: "Editar incidencias" },
    });
    await prisma.rolePermission.createMany({
      data: [{ roleId: role.id, permissionId: perm.id }, { roleId: role.id, permissionId: editPerm.id }],
    });
    await prisma.membership.create({ data: { userId, organizationId: orgId, roleId: role.id } });
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    statusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    const project = await prisma.project.create({
      data: { key: "CT", name: "CT", organizationId: orgId, workflowId: wf.id },
    });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId, color: "#123" } })).id;

    const g = generateApiKey();
    key = g.key;
    await prisma.apiKey.create({
      data: { name: "ct", keyPrefix: g.keyPrefix, keyHash: g.keyHash, userId, scopes: ["READ", "WRITE"] },
    });

    const created = await createIssue(
      new NextRequest(`http://localhost/api/v1/projects/${projectId}/issues`, {
        method: "POST",
        headers: auth({ "content-type": "application/json" }),
        body: JSON.stringify({ issueTypeId: typeId, title: "primera" }),
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    firstIssueId = (await created.json()).issue.id;
    const created2 = await createIssue(
      new NextRequest(`http://localhost/api/v1/projects/${projectId}/issues`, {
        method: "POST",
        headers: auth({ "content-type": "application/json" }),
        body: JSON.stringify({ issueTypeId: typeId, title: "segunda" }),
      }),
      { params: Promise.resolve({ id: projectId }) },
    );
    secondIssueId = (await created2.json()).issue.id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("listado de incidencias cumple issueListResponse", async () => {
    const res = await listIssues(
      new NextRequest(`http://localhost/api/v1/projects/${projectId}/issues?limit=10`, { headers: auth() }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(res.status).toBe(200);
    expect(issueListResponse.safeParse(await res.json()).success).toBe(true);
  });

  it("incidencia individual cumple issueResponse", async () => {
    const res = await getIssue(new NextRequest(`http://localhost/api/v1/issues/${firstIssueId}`, { headers: auth() }), {
      params: Promise.resolve({ id: firstIssueId }),
    });
    expect(issueResponse.safeParse(await res.json()).success).toBe(true);
  });

  it("actualización cumple issueResponse", async () => {
    const res = await patchIssue(
      new NextRequest(`http://localhost/api/v1/issues/${firstIssueId}`, {
        method: "PATCH",
        headers: auth({ "content-type": "application/json" }),
        body: JSON.stringify({ title: "primera editada" }),
      }),
      { params: Promise.resolve({ id: firstIssueId }) },
    );
    expect(res.status).toBe(200);
    expect(issueResponse.safeParse(await res.json()).success).toBe(true);
  });

  it("reordenamiento cumple rankResponse", async () => {
    const res = await rankIssue(
      new NextRequest(`http://localhost/api/v1/issues/${firstIssueId}/rank`, {
        method: "POST",
        headers: auth({ "content-type": "application/json" }),
        body: JSON.stringify({ previousId: null, nextId: secondIssueId }),
      }),
      { params: Promise.resolve({ id: firstIssueId }) },
    );
    expect(res.status).toBe(200);
    expect(rankResponse.safeParse(await res.json()).success).toBe(true);
  });

  it("listado de proyectos cumple projectListResponse", async () => {
    const res = await listProjects(new NextRequest("http://localhost/api/v1/projects", { headers: auth() }));
    expect(projectListResponse.safeParse(await res.json()).success).toBe(true);
  });

  it("tipos de incidencia cumplen issueTypeListResponse", async () => {
    const res = await listIssueTypes(
      new NextRequest(`http://localhost/api/v1/projects/${projectId}/issue-types`, { headers: auth() }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(issueTypeListResponse.safeParse(await res.json()).success).toBe(true);
  });

  it("los errores cumplen errorBody (401 y 422)", async () => {
    const noAuth = await listIssues(new NextRequest(`http://localhost/api/v1/projects/${projectId}/issues`), {
      params: Promise.resolve({ id: projectId }),
    });
    expect(errorBody.safeParse(await noAuth.json()).success).toBe(true);

    const bad = await listIssues(
      new NextRequest(`http://localhost/api/v1/projects/${projectId}/issues?limit=500`, { headers: auth() }),
      { params: Promise.resolve({ id: projectId }) },
    );
    expect(bad.status).toBe(422);
    expect(errorBody.safeParse(await bad.json()).success).toBe(true);
  });
});
