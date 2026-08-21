import type { Prisma, StatusCategory } from "@prisma/client";

/** Global permission catalog. Keys are checked by lib/permissions.ts. */
export const SYSTEM_PERMISSIONS = [
  { key: "org.manage", description: "Administrar la organización" },
  { key: "member.manage", description: "Gestionar miembros y roles" },
  { key: "project.create", description: "Crear proyectos" },
  { key: "project.manage", description: "Editar la configuración del proyecto" },
  { key: "project.delete", description: "Eliminar proyectos" },
  { key: "workflow.edit", description: "Editar el flujo de trabajo" },
  { key: "issue.create", description: "Crear incidencias" },
  { key: "issue.edit", description: "Editar incidencias" },
  { key: "issue.delete", description: "Eliminar incidencias" },
  { key: "issue.transition", description: "Mover incidencias entre estados" },
  { key: "sprint.manage", description: "Gestionar sprints" },
  { key: "testing.manage", description: "Gestionar pruebas (Xray)" },
  { key: "mural.edit", description: "Editar el mural" },
] as const;

export type SystemPermissionKey = (typeof SYSTEM_PERMISSIONS)[number]["key"];

export const DEFAULT_ROLES: Record<"Admin" | "Member" | "Viewer", SystemPermissionKey[]> = {
  Admin: SYSTEM_PERMISSIONS.map((p) => p.key),
  Member: [
    "issue.create",
    "issue.edit",
    "issue.transition",
    "sprint.manage",
    "testing.manage",
    "mural.edit",
  ],
  Viewer: [],
};

export const DEFAULT_WORKFLOW_STATUSES: {
  name: string;
  category: StatusCategory;
  color: string;
  order: number;
  isInitial?: boolean;
}[] = [
  { name: "Por hacer", category: "TODO", color: "#94A3B8", order: 0, isInitial: true },
  { name: "En progreso", category: "IN_PROGRESS", color: "#2952CC", order: 1 },
  { name: "En revisión", category: "IN_REVIEW", color: "#D97706", order: 2 },
  { name: "Hecho", category: "DONE", color: "#16A34A", order: 3 },
];

/** Linear happy-path transitions plus the ability to send anything back to To Do. */
export const DEFAULT_WORKFLOW_TRANSITIONS: { name: string; from: string; to: string }[] = [
  { name: "Empezar", from: "Por hacer", to: "En progreso" },
  { name: "Enviar a revisión", from: "En progreso", to: "En revisión" },
  { name: "Aprobar", from: "En revisión", to: "Hecho" },
  { name: "Rechazar", from: "En revisión", to: "En progreso" },
  { name: "Reabrir", from: "Hecho", to: "Por hacer" },
];

export const DEFAULT_ISSUE_TYPES: {
  name: string;
  icon: string;
  color: string;
  isSubtask?: boolean;
}[] = [
  { name: "Épica", icon: "zap", color: "#7C3AED" },
  { name: "Historia", icon: "bookmark", color: "#16A34A" },
  { name: "Tarea", icon: "check-square", color: "#2952CC" },
  { name: "Bug", icon: "bug", color: "#DC2626" },
  { name: "Subtarea", icon: "corner-down-right", color: "#64748B", isSubtask: true },
  { name: "Caso de Prueba", icon: "flask-conical", color: "#0EA5E9" },
];

/** Creates the Admin/Member/Viewer roles for a brand-new organization. */
export async function createDefaultRoles(
  tx: Prisma.TransactionClient,
  organizationId: string,
) {
  await tx.permission.createMany({
    data: SYSTEM_PERMISSIONS.map((p) => ({ key: p.key, description: p.description })),
    skipDuplicates: true,
  });
  const permissions = await tx.permission.findMany();
  const permissionByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const roles: Record<string, string> = {};
  for (const [roleName, permissionKeys] of Object.entries(DEFAULT_ROLES)) {
    const role = await tx.role.create({
      data: {
        name: roleName,
        scope: "ORGANIZATION",
        isSystem: true,
        organizationId,
        permissions: {
          create: permissionKeys.map((key) => ({
            permission: { connect: { id: permissionByKey.get(key)! } },
          })),
        },
      },
    });
    roles[roleName] = role.id;
  }
  return roles;
}

/** Creates a fresh Workflow with the standard 4-status pipeline for a new project. */
export async function createDefaultWorkflow(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
) {
  const workflow = await tx.workflow.create({
    data: { name, organizationId },
  });

  const statusByName = new Map<string, string>();
  for (const status of DEFAULT_WORKFLOW_STATUSES) {
    const created = await tx.workflowStatus.create({
      data: { ...status, workflowId: workflow.id },
    });
    statusByName.set(status.name, created.id);
  }

  for (const transition of DEFAULT_WORKFLOW_TRANSITIONS) {
    await tx.workflowTransition.create({
      data: {
        name: transition.name,
        workflowId: workflow.id,
        fromStatusId: statusByName.get(transition.from)!,
        toStatusId: statusByName.get(transition.to)!,
      },
    });
  }

  return { workflowId: workflow.id, initialStatusId: statusByName.get("Por hacer")! };
}

/** Creates the standard issue-type set (Epic/Story/Task/Bug/Subtask/Test Case) for a project. */
export async function createDefaultIssueTypes(
  tx: Prisma.TransactionClient,
  projectId: string,
) {
  const types: Record<string, string> = {};
  for (const type of DEFAULT_ISSUE_TYPES) {
    const created = await tx.issueType.create({
      data: { ...type, projectId },
    });
    types[type.name] = created.id;
  }
  return types;
}
