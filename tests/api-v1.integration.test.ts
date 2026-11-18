import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import { GET as listIssues } from "@/app/api/v1/projects/[id]/issues/route";
import { GET as listProjects } from "@/app/api/v1/projects/route";

/**
 * Contrato de la API v1 (F0-5) contra la base real: paginación por cursor,
 * límite máximo de 100, filtros y formato uniforme de error.
 */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("API v1 — paginación, filtros y errores", () => {
  let orgId: string;
  let projectId: string;
  let userId: string;
  let key: string;
  let todoStatusId: string;
  let doneStatusId: string;
  let typeId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { id: `v1-${suffix}`, email: `v1-${suffix}@test.local` } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: "V1", slug: `v1-${suffix}` } });
    orgId = org.id;
    const role = await prisma.role.create({
      data: { name: "Member", scope: "ORGANIZATION", organizationId: orgId },
    });
    await prisma.membership.create({ data: { userId, organizationId: orgId, roleId: role.id } });
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    todoStatusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    doneStatusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Hecho", category: "DONE", color: "#0f0" },
    })).id;
    const project = await prisma.project.create({
      data: { key: "V1", name: "V1", organizationId: orgId, workflowId: wf.id },
    });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;

    for (let n = 1; n <= 5; n++) {
      const issue = await prisma.issue.create({
        data: {
          key: `V1-${n}`, number: n, title: `t${n}`, projectId, issueTypeId: typeId,
          statusId: n % 2 === 0 ? doneStatusId : todoStatusId, reporterId: userId,
        },
      });
      ids.push(issue.id);
    }

    const generated = generateApiKey();
    key = generated.key;
    await prisma.apiKey.create({
      data: { name: "test", keyPrefix: generated.keyPrefix, keyHash: generated.keyHash, userId },
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const call = (qs: string, auth = true) => {
    const headers: Record<string, string> = auth ? { authorization: `Bearer ${key}` } : {};
    const url = `http://localhost/api/v1/projects/${projectId}/issues${qs}`;
    return listIssues(new NextRequest(url, { headers }), { params: Promise.resolve({ id: projectId }) });
  };

  it("sin llave: 401 con código uniforme", async () => {
    const res = await call("", false);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthenticated");
  });

  it("recorre todas las páginas con cursor sin repetir ni saltar ítems", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const res = await call(`?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.issues.length).toBeLessThanOrEqual(2);
      seen.push(...body.issues.map((i: { id: string }) => i.id));
      cursor = body.nextCursor;
      pages++;
    } while (cursor && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);
    expect(seen.sort()).toEqual([...ids].sort());
  });

  it("limit por encima de 100 devuelve 422 con el campo señalado", async () => {
    const res = await call("?limit=101");
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.fields.limit).toBeDefined();
  });

  it("cursor inválido devuelve 422 invalid_cursor", async () => {
    const res = await call("?cursor=basura");
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("invalid_cursor");
  });

  it("filtro por estado devuelve solo las incidencias de ese estado", async () => {
    const res = await call(`?status=${doneStatusId}`);
    const body = await res.json();
    expect(body.issues.length).toBe(2);
    expect(body.issues.every((i: { statusId?: string; status: { id: string } }) => i.status.id === doneStatusId)).toBe(true);
  });

  it("updatedSince con fecha inválida devuelve 422", async () => {
    const res = await call("?updatedSince=ayer");
    expect(res.status).toBe(422);
    expect((await res.json()).error.fields.updatedSince).toBeDefined();
  });

  it("updatedSince en el futuro no devuelve nada", async () => {
    const res = await call(`?updatedSince=${encodeURIComponent(new Date(Date.now() + 86400000).toISOString())}`);
    expect((await res.json()).issues).toEqual([]);
  });

  it("listado de proyectos también pagina", async () => {
    const res = await listProjects(new NextRequest("http://localhost/api/v1/projects?limit=1", {
      headers: { authorization: `Bearer ${key}` },
    }));
    const body = await res.json();
    expect(body.projects.length).toBe(1);
    expect(body.nextCursor === null || typeof body.nextCursor === "string").toBe(true);
  });
});
