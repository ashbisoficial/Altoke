import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import { GET as listIssues, POST as createIssueRoute } from "@/app/api/v1/projects/[id]/issues/route";

/**
 * F0-7 contra la base real: alcances, caducidad y límite de uso.
 */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("llaves de API: alcances, caducidad y límite", () => {
  let orgId: string;
  let projectId: string;
  let userId: string;
  let typeId: string;
  let statusId: string;
  const keys: Record<string, string> = {};

  async function makeKey(label: string, data: Partial<{ scopes: ("READ" | "WRITE" | "TEST_RESULTS")[]; expiresAt: Date | null; requestsPerMinute: number }>) {
    const g = generateApiKey();
    await prisma.apiKey.create({
      data: { name: label, keyPrefix: g.keyPrefix, keyHash: g.keyHash, userId, ...data },
    });
    keys[label] = g.key;
  }

  const req = (method: string, label: string, body?: unknown) =>
    new NextRequest(`http://localhost/api/v1/projects/${projectId}/issues`, {
      method,
      headers: { authorization: `Bearer ${keys[label]}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { id: `ak-${suffix}`, email: `ak-${suffix}@test.local` } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: "AK", slug: `ak-${suffix}` } });
    orgId = org.id;
    const role = await prisma.role.create({ data: { name: "Member", scope: "ORGANIZATION", organizationId: orgId } });
    const perm = await prisma.permission.upsert({
      where: { key: "issue.create" },
      update: {},
      create: { key: "issue.create", description: "Crear incidencias" },
    });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    await prisma.membership.create({ data: { userId, organizationId: orgId, roleId: role.id } });
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    statusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    const project = await prisma.project.create({ data: { key: "AK", name: "AK", organizationId: orgId, workflowId: wf.id } });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;

    await makeKey("read", { scopes: ["READ"] });
    await makeKey("expired", { scopes: ["READ"], expiresAt: new Date(Date.now() - 1000) });
    await makeKey("tiny", { scopes: ["READ", "WRITE"], requestsPerMinute: 3 });
    await makeKey("write", { scopes: ["READ", "WRITE"] });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it("una llave de solo lectura lista incidencias (200)", async () => {
    const res = await listIssues(req("GET", "read"), { params: Promise.resolve({ id: projectId }) });
    expect(res.status).toBe(200);
  });

  it("una llave de solo lectura recibe 403 al escribir, con código insufficient_scope", async () => {
    const res = await createIssueRoute(req("POST", "read", { issueTypeId: typeId, title: "x" }), {
      params: Promise.resolve({ id: projectId }),
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("insufficient_scope");
  });

  it("una llave caducada recibe 401 con key_expired", async () => {
    const res = await listIssues(req("GET", "expired"), { params: Promise.resolve({ id: projectId }) });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("key_expired");
  });

  it("al exceder el límite por minuto devuelve 429 con Retry-After", async () => {
    const statuses: number[] = [];
    let last: Response | null = null;
    for (let i = 0; i < 4; i++) {
      last = await listIssues(req("GET", "tiny"), { params: Promise.resolve({ id: projectId }) });
      statuses.push(last.status);
    }
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
    const retry = Number(last!.headers.get("Retry-After"));
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(60);
    expect((await last!.json()).error.code).toBe("rate_limited");
  });

  it("una llave con alcance de escritura sí puede crear incidencias (201)", async () => {
    const res = await createIssueRoute(req("POST", "write", { issueTypeId: typeId, title: "creada por API" }), {
      params: Promise.resolve({ id: projectId }),
    });
    expect(res.status).toBe(201);
  });

  it("las llaves nuevas empiezan solo con READ por defecto", async () => {
    const row = await prisma.apiKey.findFirstOrThrow({ where: { name: "read", userId } });
    expect(row.scopes).toEqual(["READ"]);
    expect(row.requestsPerMinute).toBe(120);
  });
});
