/**
 * Error de la capa de servicio con código HTTP. Vive aparte para que los
 * módulos de dominio puedan usarlo sin importar issue-service (evita ciclos).
 */
export class ServiceError extends Error {
  status: number;
  /** Errores por campo (422), para mostrarlos junto a cada campo. */
  fields?: Record<string, string[]>;
  constructor(status: number, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}
