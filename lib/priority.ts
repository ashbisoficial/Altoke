export type Priority = "HIGHEST" | "HIGH" | "MEDIUM" | "LOW" | "LOWEST";

// Orden de más a menos urgente — coincide con el orden declarado en el enum
// de Prisma, así que también sirve para ordenar resultados de la base.
export const PRIORITY_ORDER: Priority[] = ["HIGHEST", "HIGH", "MEDIUM", "LOW", "LOWEST"];

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGHEST: "Urgente",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
  LOWEST: "Muy baja",
};
