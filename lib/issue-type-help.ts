/**
 * Plain-language explanations shown next to the issue-type picker, aimed at
 * people with no project-management background. Keyed by the seeded type
 * names in lib/seed-defaults.ts.
 */
export const ISSUE_TYPE_HELP: Record<string, string> = {
  Épica: "Un objetivo grande. No se trabaja directo — se divide en Historias o Tareas más chicas.",
  Historia: "Algo que le sirve a alguien que usa el proyecto, contado en pocas palabras.",
  Tarea: "Un trabajo concreto que una persona puede hacer de principio a fin.",
  Bug: "Algo que no está funcionando bien y hay que arreglar.",
  Subtarea: "Un paso chiquito dentro de otra tarea o historia.",
  "Caso de Prueba": "Los pasos para comprobar que algo funciona como debería.",
};
