import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { SYSTEM_PERMISSIONS, DEFAULT_ROLES, createDefaultRoles, type SystemPermissionKey } from "@/lib/seed-defaults";
import { hasOrgPermission, hasProjectPermission } from "@/lib/permissions";

// La sesión se simula: cada prueba fija qué usuario "ha iniciado sesión".
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => session.user }));

import { POST as createIssueRoute } from "@/app/api/issues/route";
import { POST as transitionRoute } from "@/app/api/issues/[id]/transition/route";
import { POST as startSprintRoute } from "@/app/api/sprints/[id]/start/route";
import { DELETE as deleteIssueRoute } from "@/app/api/issues/[id]/route";

/**
 * F0-11: matriz rol × permiso y pruebas de las rutas que los usan, contra la
 * base real. Roles del sistema: Admin, Member, Viewer (ver DEFAULT_ROLES).
 */
const enabled = !!process.env.DATABASE_URL;
const suffix = `${Date.now()}`;

describe.runIf(enabled)("matriz de permisos", () => {
  const ids = { org: "", project: "", users: {} as Record<"Admin" | "Member" | "Viewer", string>, typeId: "", todo: "", doing: "", sprint: "", issueId: "" };

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: "PM", slug: `pm-${suffix}` } });
    ids.org = org.id;

    const roles = await prisma.$transaction((tx) => createDefaultRoles(tx, org.id));

    for (const role of ["Admin", "Member", "Viewer"] as const) {
      const user = await prisma.user.create({ data: { id: `pm-${role}-${suffix}`, email: `pm-${role}-${suffix}@test.local` } });
      ids.users[role] = user.id;
      await prisma.membership.create({ data: { userId: user.id, organizationId: org.id, roleId: roles[role] } });
    }

    const wf = await prisma.workflow.create({ data: { name: "WF", organizationId: org.id } });
    ids.todo = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "Por hacer", category: "TODO", color: "#000", isInitial: true },
    })).id;
    ids.doing = (await prisma.workflowStatus.create({
      data: { workflowId: wf.id, name: "En progreso", category: "IN_PROGRESS", color: "#00f" },
    })).id;
    await prisma.workflowTransition.create({
      data: { workflowId: wf.id, name: "Empezar", fromStatusId: ids.todo, toStatusId: ids.doing },
    });

    // issueCounter: 1 porque la incidencia base ya tiene el número 1.
    const project = await prisma.project.create({ data: { key: "PM", name: "PM", organizationId: org.id, workflowId: wf.id, issueCounter: 1 } });
    ids.project = project.id;
    ids.typeId = (await prisma.issueType.create({ data: { name: "Tarea", projectId: project.id } })).id;

    ids.sprint = (await prisma.sprint.create({
      data: { projectId: project.id, name: "S", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-30") },
    })).id;

    ids.issueId = (await prisma.issue.create({
      data: { key: "PM-1", number: 1, title: "base", projectId: project.id, issueTypeId: ids.typeId, statusId: ids.todo, reporterId: ids.users.Admin },
    })).id;
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids.users) } } });
    await prisma.$disconnect();
  });

  describe("matriz: cada permiso para cada rol", () => {
    for (const role of ["Admin", "Member", "Viewer"] as const) {
      for (const perm of SYSTEM_PERMISSIONS.map((p) => p.key)) {
        const expected = (DEFAULT_ROLES[role] as SystemPermissionKey[]).includes(perm);
        it(`${role} ${expected ? "puede" : "no puede"} ${perm} (organización y proyecto)`, async () => {
          expect(await hasOrgPermission(ids.users[role], ids.org, perm)).toBe(expected);
          // Sin membresía de proyecto, el proyecto cae en el permiso de la organización.
          expect(await hasProjectPermission(ids.users[role], ids.project, perm)).toBe(expected);
        });
      }
    }
  });

  it("la matriz cubre los 13 permisos del sistema", () => {
    expect(SYSTEM_PERMISSIONS).toHaveLength(13);
  });

  describe("rutas con sesión simulada", () => {
    const withUser = (role: "Admin" | "Member" | "Viewer") => {
      session.user = { id: ids.users[role] };
    };

    it("crear incidencia: Member sí (201), Viewer no (403)", async () => {
      const body = JSON.stringify({ projectId: ids.project, issueTypeId: ids.typeId, title: "nueva" });
      const req = () => new NextRequest("http://localhost/api/issues", { method: "POST", body, headers: { "content-type": "application/json" } });

      withUser("Member");
      expect((await createIssueRoute(req())).status).toBe(201);

      withUser("Viewer");
      expect((await createIssueRoute(req())).status).toBe(403);
    });

    it("transición: Member sí (200), Viewer no (403)", async () => {
      const ctx = { params: Promise.resolve({ id: ids.issueId }) };
      const req = () =>
        new NextRequest(`http://localhost/api/issues/${ids.issueId}/transition`, {
          method: "POST",
          body: JSON.stringify({ toStatusId: ids.doing }),
          headers: { "content-type": "application/json" },
        });

      withUser("Viewer");
      expect((await transitionRoute(req(), ctx)).status).toBe(403);

      withUser("Member");
      expect((await transitionRoute(req(), ctx)).status).toBe(200);
    });

    it("iniciar sprint: Member sí (sprint.manage), Viewer no (403)", async () => {
      const ctx = { params: Promise.resolve({ id: ids.sprint }) };
      const req = () => new NextRequest(`http://localhost/api/sprints/${ids.sprint}/start`, { method: "POST" });

      withUser("Viewer");
      expect((await startSprintRoute(req(), ctx)).status).toBe(403);

      withUser("Member");
      expect((await startSprintRoute(req(), ctx)).status).toBe(200);
    });

    it("borrar incidencia: Member no tiene issue.delete (403); Admin sí (200)", async () => {
      const ctx = { params: Promise.resolve({ id: ids.issueId }) };
      const req = () => new NextRequest(`http://localhost/api/issues/${ids.issueId}`, { method: "DELETE" });

      withUser("Member");
      expect((await deleteIssueRoute(req(), ctx)).status).toBe(403);

      withUser("Admin");
      expect((await deleteIssueRoute(req(), ctx)).status).toBe(200);
    });

    it("sin sesión: 401", async () => {
      session.user = null;
      const res = await createIssueRoute(new NextRequest("http://localhost/api/issues", { method: "POST", body: "{}" }));
      expect(res.status).toBe(401);
    });
  });
});
