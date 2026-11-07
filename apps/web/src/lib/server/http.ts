// shared/index.ts re-exporta con sufijo ".js" que Turbopack no resuelve;
// se importa el archivo directo. Cuando shared se ajuste, volver a
// "@contractar/shared".
import { ERROR_MESSAGES } from "../../../../../shared/errors";

// code: clave de shared/errors.ts para errores de dominio; códigos propios sólo
// para fallos de transporte/infraestructura que el mapa compartido no cubre.
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message?: string) {
    super(message ?? ERROR_MESSAGES[code] ?? code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

export function apiErr(code: keyof typeof ERROR_MESSAGES, status = 400, message?: string): ApiError {
  return new ApiError(code, status, message);
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      return json({ error: { code: err.code, message: err.message } }, err.status);
    }
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: { code: "InternalError", message } }, 500);
  }
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    throw new ApiError("BadRequest", 400, "El cuerpo de la petición no es JSON válido.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ApiError("BadRequest", 400, "El cuerpo de la petición debe ser un objeto JSON.");
  }
  return parsed as Record<string, unknown>;
}

export function reqString(v: unknown, name: string): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new ApiError("BadRequest", 400, `Falta o es inválido: ${name}.`);
  }
  return v;
}

export function optString(v: unknown, name: string): string | undefined {
  if (v === undefined || v === null) return undefined;
  return reqString(v, name);
}

// Montos ARS: enteros en centavos, jamás float (spec 02).
export function reqCents(v: unknown, name: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new ApiError("BadRequest", 400, `${name} debe ser un entero positivo en centavos ARS.`);
  }
  return v;
}

export function optCents(v: unknown, name: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new ApiError("BadRequest", 400, `${name} debe ser un entero en centavos ARS.`);
  }
  return v;
}
