/**
 * Datos semilla deterministas para QA (F0-1): `npm run seed:qa`.
 *
 * Deja una organización "altoke-qa" en estado conocido:
 *   - Tres usuarios con rol Admin, Member y Viewer.
 *   - Un proyecto "QA" con incidencias en los cuatro estados del flujo,
 *     asignadas, con comentarios, etiquetas y un caso de prueba.
 *   - Tres sprints: completado, activo y planeado.
 *
 * Es idempotente: borra la organización y la vuelve a crear, así que siempre
 * deja el mismo contenido. Pensado para staging y para la base de CI; nunca
 * para producción (lo impide la variable ALTOKE_ENV=production).
 *
 * Variables:
 *   SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL + QA_PASSWORD
 *       crean también los usuarios en Supabase Auth, para poder iniciar sesión.
 *       Sin ellas solo se crean las filas de la base (suficiente para pruebas).
 */
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDefaultIssueTypes, createDefaultRoles, createDefaultWorkflow } from "@/lib/seed-defaults";
import { createIssue } from "@/lib/issue-service";

export const QA_SLUG = "altoke-qa";

export const QA_USERS = [
  { role: "Admin", email: "qa.admin@altoke.test", name: "QA Admin", fallbackId: "qa-user-admin" },
  { role: "Member", email: "qa.member@altoke.test", name: "QA Member", fallbackId: "qa-user-member" },
  { role: "Viewer", email: "qa.viewer@altoke.test", name: "QA Viewer", fallbackId: "qa-user-viewer" },
] as const;

/** Si hay credenciales de Supabase, crea (o reutiliza) el usuario en Auth y devuelve su id. */
async function ensureAuthUser(email: string, name: string, fallbackId: string): Promise<string> {
  const supabaseReady = !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseReady) return fallbackId;

  const password = process.env.QA_PASSWORD;
  if (!password) throw new Error("Define QA_PASSWORD para crear los usuarios de QA en Supabase Auth");

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (created.data.user) return created.data.user.id;

  // Ya existía: se busca por correo para reutilizar su id.
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list.data.users.find((u) => u.email === email);
  if (!existing) throw new Error(`No se pudo crear ni encontrar el usuario ${email}: ${created.error?.message}`);
  return existing.id;
}

export async function seedQa() {
  if (process.env.ALTOKE_ENV === "production") {
    throw new Error("seed:qa no se ejecuta en producción");
  }

  // 1. Usuarios (filas de la base; el id coincide con Supabase Auth cuando existe).
  const users: Record<string, string> = {};
  for (const u of QA_USERS) {
    const id = await ensureAuthUser(u.email, u.name, u.fallbackId);
    await prisma.user.upsert({
      where: { id },
      update: { email: u.email, name: u.name },
      create: { id, email: u.email, name: u.name },
    });
    users[u.role] = id;
  }

  // 2. Reinicio: borrar la organización de QA (en cascada) antes de recrearla.
  await prisma.organization.deleteMany({ where: { slug: QA_SLUG } });

  // 3. Organización, roles, flujo, proyecto, tipos y membresías.
  const { org, project, workflowStatuses } = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name: "Altoke QA", slug: QA_SLUG } });
    const roles = await createDefaultRoles(tx, org.id);
    for (const u of QA_USERS) {
      await tx.membership.create({ data: { userId: users[u.role], organizationId: org.id, roleId: roles[u.role] } });
    }
    const { workflowId } = await createDefaultWorkflow(tx, org.id, "Flujo QA");
    const project = await tx.project.create({
      data: { key: "QA", name: "Proyecto QA", organizationId: org.id, workflowId, issueCounter: 0 },
    });
    await createDefaultIssueTypes(tx, project.id);
    const workflowStatuses = await tx.workflowStatus.findMany({ where: { workflowId } });
    return { org, project, workflowStatuses };
  });

  const status = (name: string) => workflowStatuses.find((s) => s.name === name)!.id;
  const typeId = (await prisma.issueType.findFirstOrThrow({ where: { projectId: project.id, name: "Tarea" } })).id;
  const bugId = (await prisma.issueType.findFirstOrThrow({ where: { projectId: project.id, name: "Bug" } })).id;
  const caseTypeId = (await prisma.issueType.findFirstOrThrow({ where: { projectId: project.id, name: "Caso de Prueba" } })).id;

  // 4. Sprints en los tres estados. Solo uno ACTIVE (lo exige la base).
  const sprintDone = await prisma.sprint.create({
    data: { projectId: project.id, name: "Sprint 0", status: "COMPLETED", startDate: new Date("2026-10-18"), endDate: new Date("2026-10-31") },
  });
  const sprintActive = await prisma.sprint.create({
    data: { projectId: project.id, name: "Sprint 1", status: "ACTIVE", startDate: new Date("2026-11-01"), endDate: new Date("2026-11-14") },
  });
  const sprintPlanned = await prisma.sprint.create({
    data: { projectId: project.id, name: "Sprint 2", status: "PLANNED", startDate: new Date("2026-11-15"), endDate: new Date("2026-11-28") },
  });

  // 5. Incidencias: cuatro estados, tres sprints o backlog, asignadas variadas.
  const statusCycle = ["Por hacer", "En progreso", "En revisión", "Hecho"] as const;
  const sprintCycle = [sprintDone.id, sprintActive.id, sprintPlanned.id, null] as const;
  const assigneeCycle = [users.Admin, users.Member, null] as const;
  const created: string[] = [];
  for (let i = 0; i < 12; i++) {
    const issue = await createIssue(users.Admin, {
      projectId: project.id,
      issueTypeId: i % 4 === 3 ? bugId : typeId,
      title: `Incidencia de QA ${String(i + 1).padStart(2, "0")}`,
      description: `Descripción de la incidencia ${i + 1}.`,
      priority: (["HIGHEST", "HIGH", "MEDIUM", "LOW"] as const)[i % 4],
    });
    created.push(issue.id);
    await prisma.issue.update({
      where: { id: issue.id },
      data: {
        statusId: status(statusCycle[i % 4]),
        sprintId: sprintCycle[i % 4],
        assigneeId: assigneeCycle[i % 3],
      },
    });
  }

  // 6. Comentarios, etiquetas y un caso de prueba enlazado.
  await prisma.comment.create({ data: { issueId: created[1], authorId: users.Member, body: "Confirmo el comportamiento." } });
  await prisma.comment.create({ data: { issueId: created[1], authorId: users.Admin, body: "Gracias, lo reviso." } });
  const labelUi = await prisma.label.create({ data: { projectId: project.id, name: "ui", color: "#0EA5E9" } });
  const labelUrgent = await prisma.label.create({ data: { projectId: project.id, name: "urgente", color: "#DC2626" } });
  await prisma.issueLabel.createMany({
    data: [
      { issueId: created[0], labelId: labelUi.id },
      { issueId: created[4], labelId: labelUrgent.id },
    ],
  });

  const caseIssue = await createIssue(users.Member, {
    projectId: project.id,
    issueTypeId: caseTypeId,
    title: "Caso: iniciar sesión con credenciales válidas",
  });
  await prisma.testCase.create({
    data: {
      issueId: caseIssue.id,
      preconditions: "Usuario QA Member existente.",
      steps: [
        { step: "Abrir la pantalla de inicio de sesión", expectedResult: "Se muestra el formulario." },
        { step: "Ingresar credenciales válidas y enviar", expectedResult: "Se entra al panel." },
      ],
    },
  });

  return {
    organizationId: org.id,
    projectId: project.id,
    users,
    counts: {
      users: QA_USERS.length,
      issues: created.length + 1,
      sprints: 3,
      statuses: statusCycle.length,
    },
  };
}

async function main() {
  const started = Date.now();
  const result = await seedQa();
  console.log(
    `seed:qa listo en ${((Date.now() - started) / 1000).toFixed(1)} s: ` +
      `organización ${QA_SLUG}, ${result.counts.users} usuarios, ` +
      `${result.counts.issues} incidencias, ${result.counts.sprints} sprints.`,
  );
}

// Solo al ejecutarlo desde la línea de comandos (no al importarlo en pruebas).
if (process.argv[1]?.endsWith("seed-qa.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
