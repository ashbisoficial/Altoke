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

export type StatusCategory = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

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
