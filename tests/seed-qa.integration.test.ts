import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { QA_SLUG, seedQa } from "@/scripts/seed-qa";

/** F0-1: el seed deja el mismo estado conocido aunque se ejecute dos veces. */
const enabled = !!process.env.DATABASE_URL;

describe.runIf(enabled)("seed:qa", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function snapshot() {
    const org = await prisma.organization.findUniqueOrThrow({ where: { slug: QA_SLUG } });
    const project = await prisma.project.findFirstOrThrow({ where: { organizationId: org.id } });
    const statuses = await prisma.issue.groupBy({
      by: ["statusId"],
      where: { projectId: project.id },
      _count: { _all: true },
    });
    const sprints = await prisma.sprint.findMany({ where: { projectId: project.id }, orderBy: { name: "asc" } });
    const roles = await prisma.membership.count({ where: { organizationId: org.id } });
    return {
      orgs: await prisma.organization.count({ where: { slug: QA_SLUG } }),
      issues: statuses.reduce((n, s) => n + s._count._all, 0),
      distinctStatuses: statuses.length,
      sprintStatuses: sprints.map((s) => s.status),
      members: roles,
    };
  }

  it("ejecutarlo dos veces deja una sola organización con el mismo contenido", async () => {
    await seedQa();
    const first = await snapshot();
    await seedQa();
    const second = await snapshot();

    expect(second).toEqual(first);
    expect(first.orgs).toBe(1);
    expect(first.issues).toBe(13);
    expect(first.distinctStatuses).toBe(4);
    expect(first.members).toBe(3);
    expect([...first.sprintStatuses].sort()).toEqual(["ACTIVE", "COMPLETED", "PLANNED"]);
  });
});
