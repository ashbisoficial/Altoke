import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/issue-service";
import { completeSprint, startSprint } from "@/lib/sprint-service";

/**
 * Prueba de integración del ciclo de vida de sprint (F0-6) contra una base
 * PostgreSQL real. Solo corre si DATABASE_URL está definida; en el CI de
 * migraciones se usa una base vacía dedicada.
 */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;
const day = (d: number) => new Date(Date.UTC(2026, 10, d));

describe.runIf(enabled)("ciclo de vida de sprint contra la base", () => {
  let orgId: string;
  let projectId: string;
  let userId: string;
  let doneStatusId: string;
  let todoStatusId: string;
  let typeId: string;
  let sprintA: string;
  let sprintB: string;
  let sprintC: string;

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { id: `u-${suffix}`, email: `t-${suffix}@test.local` } });
    userId = user.id;
    const org = await prisma.organization.create({ data: { name: "Test", slug: `t-${suffix}` } });
    orgId = org.id;
    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: orgId } });
    const todo = await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    });
    const done = await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Hecho", category: "DONE", color: "#0f0" },
    });
    todoStatusId = todo.id;
    doneStatusId = done.id;
    const project = await prisma.project.create({
      data: { key: "TST", name: "Test", organizationId: orgId, workflowId: wf.id },
    });
    projectId = project.id;
    const type = await prisma.issueType.create({ data: { name: "Tarea", projectId } });
    typeId = type.id;

    sprintA = (await prisma.sprint.create({
      data: { projectId, name: "A", startDate: day(1), endDate: day(10) },
    })).id;
    sprintB = (await prisma.sprint.create({
      data: { projectId, name: "B", startDate: day(11), endDate: day(20) },
    })).id;
    sprintC = (await prisma.sprint.create({ data: { projectId, name: "C" } })).id;
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.workflow.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  async function issue(n: number, sprintId: string, statusId: string) {
    return prisma.issue.create({
      data: {
        key: `TST-${n}`, number: n, title: `t${n}`, projectId, issueTypeId: typeId,
        statusId, reporterId: userId, sprintId,
      },
    });
  }

  it("iniciar sprint sin fechas devuelve 422", async () => {
    await expect(startSprint(sprintC)).rejects.toMatchObject({ status: 422 });
  });

  it("iniciar un sprint planeado lo activa", async () => {
    const s = await startSprint(sprintA);
    expect(s.status).toBe("ACTIVE");
  });

  it("un segundo sprint activo en el mismo proyecto devuelve 409", async () => {
    const err = await startSprint(sprintB).catch((e) => e);
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.status).toBe(409);
  });

  it("iniciar un sprint que ya está activo devuelve 409", async () => {
    await expect(startSprint(sprintA)).rejects.toMatchObject({ status: 409 });
  });

  it("completar: las incidencias sin terminar van al backlog, las terminadas se quedan", async () => {
    const open = await issue(101, sprintA, todoStatusId);
    const finished = await issue(102, sprintA, doneStatusId);

    const result = await completeSprint(userId, sprintA, { target: "BACKLOG" });
    expect(result.sprint.status).toBe("COMPLETED");
    expect(result.movedIssues).toBe(1);

    expect((await prisma.issue.findUniqueOrThrow({ where: { id: open.id } })).sprintId).toBeNull();
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: finished.id } })).sprintId).toBe(sprintA);

    const activity = await prisma.issueActivity.findFirst({ where: { issueId: open.id, field: "sprint" } });
    expect(activity?.fromLabel).toBe("A");
    expect(activity?.toLabel).toBe("Backlog");
  });

  it("completar un sprint que no está activo devuelve 409", async () => {
    await expect(completeSprint(userId, sprintA, { target: "BACKLOG" })).rejects.toMatchObject({ status: 409 });
  });

  it("completar hacia un sprint siguiente mueve ahí las incidencias pendientes", async () => {
    await startSprint(sprintB);
    const open = await issue(201, sprintB, todoStatusId);
    const result = await completeSprint(userId, sprintB, { target: "NEXT_SPRINT", nextSprintId: sprintC });
    expect(result.destination).toBe("C");
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: open.id } })).sprintId).toBe(sprintC);
  });

  it("el destino debe ser un sprint planeado del mismo proyecto", async () => {
    await startSprint(sprintC).catch(() => {}); // sprintC sin fechas: no se activa
    await expect(
      completeSprint(userId, sprintB, { target: "NEXT_SPRINT", nextSprintId: sprintB }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
