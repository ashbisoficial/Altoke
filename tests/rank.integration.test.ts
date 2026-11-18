import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createIssue } from "@/lib/issue-service";
import { ensureProjectRanks, moveIssueRank } from "@/lib/rank-service";
import { ServiceError } from "@/lib/issue-service";

/**
 * F0-4 contra la base real: backfill, creación concurrente, reordenamiento
 * y reordenamientos simultáneos en el mismo hueco.
 */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("rank de incidencias", () => {
  let orgId: string;
  let projectId: string;
  let userId: string;
  let typeId: string;
  let statusId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { id: `rk-${suffix}`, email: `rk-${suffix}@test.local` } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: "RK", slug: `rk-${suffix}` } });
    orgId = org.id;
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    statusId = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    const project = await prisma.project.create({
      data: { key: "RK", name: "RK", organizationId: orgId, workflowId: wf.id },
    });
    projectId = project.id;
    typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId } })).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  const titles = async () =>
    (await prisma.issue.findMany({ where: { projectId }, orderBy: { rank: "asc" }, select: { title: true, rank: true } }));

  it("creación concurrente: diez incidencias a la vez quedan con rank distinto y en orden", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, n) =>
        createIssue(userId, { projectId, issueTypeId: typeId, title: `c${n}` }),
      ),
    );
    const rows = await titles();
    expect(rows).toHaveLength(10);
    const ranks = rows.map((r) => r.rank);
    expect(new Set(ranks).size).toBe(10);
    expect(ranks.every((r) => !!r)).toBe(true);
  });

  it("backfill: incidencias sin rank reciben uno al final, en orden de creación", async () => {
    await prisma.issue.create({
      data: { key: "RK-999", number: 999, title: "sin-rank", projectId, issueTypeId: typeId, statusId, reporterId: userId },
    });
    const assigned = await ensureProjectRanks(projectId);
    expect(assigned).toBe(1);
    expect(await ensureProjectRanks(projectId)).toBe(0);
    const last = (await titles()).at(-1)!;
    expect(last.title).toBe("sin-rank");
  });

  it("mover una incidencia entre dos vecinos la deja en esa posición", async () => {
    const rows = await prisma.issue.findMany({ where: { projectId }, orderBy: { rank: "asc" }, select: { id: true, title: true } });
    const [a, , , d] = rows;
    const moving = rows[rows.length - 1];
    await moveIssueRank(moving.id, { previousId: a.id, nextId: rows[1].id });
    const after = await prisma.issue.findMany({ where: { projectId }, orderBy: { rank: "asc" }, select: { id: true } });
    expect(after.findIndex((r) => r.id === moving.id)).toBe(1);
    expect(d).toBeDefined();
  });

  it("dos reordenamientos simultáneos en el mismo hueco no duplican ni pierden posiciones", async () => {
    const rows = await prisma.issue.findMany({ where: { projectId }, orderBy: { rank: "asc" }, select: { id: true } });
    const left = rows[0].id;
    const right = rows[1].id;
    const movers = rows.slice(3, 9).map((r) => r.id);

    const results = await Promise.allSettled(
      movers.map((id) => moveIssueRank(id, { previousId: left, nextId: right })),
    );
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    for (const f of failed) expect(f.reason).toBeInstanceOf(ServiceError);

    const all = await prisma.issue.findMany({ where: { projectId }, select: { id: true, rank: true } });
    expect(all.length).toBe(rows.length);
    expect(new Set(all.map((r) => r.rank)).size).toBe(all.length);
    const moved = results.filter((r) => r.status === "fulfilled").length;
    expect(moved).toBe(movers.length);
  });

  it("vecinos desordenados o de otro proyecto devuelven error", async () => {
    const [first, second] = await prisma.issue.findMany({ where: { projectId }, orderBy: { rank: "asc" }, take: 2, select: { id: true } });
    await expect(moveIssueRank(second.id, { previousId: second.id })).rejects.toBeInstanceOf(ServiceError);
    await expect(moveIssueRank(first.id, { previousId: second.id, nextId: first.id })).rejects.toBeInstanceOf(ServiceError);
  });
});
