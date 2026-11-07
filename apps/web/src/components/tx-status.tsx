"use client";

// Ciclo de estados de una operación: esperando firma → enviada → confirmando →
// confirmada / fallida. La firma real la ejecuta el operador de demo del lado
// del servidor; la UI refleja el ciclo completo (M4).

import { Check, LoaderCircle, TriangleAlert } from "lucide-react";

export type Fase = "idle" | "firma" | "enviada" | "confirmando" | "confirmada" | "fallida";

export const FASES: Record<Exclude<Fase, "idle">, string> = {
  firma: "Esperando firma (la ejecuta el operador de demo)…",
  enviada: "Operación enviada…",
  confirmando: "Esperando confirmación…",
  confirmada: "Operación confirmada.",
  fallida: "La operación falló.",
};

export function TxStatus({ fase, error }: { fase: Fase; error?: string }) {
  if (fase === "idle") return null;
  const enCurso = fase === "firma" || fase === "enviada" || fase === "confirmando";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
        fase === "confirmada"
          ? "border-green/60 text-green"
          : fase === "fallida"
            ? "border-coral/60 text-coral"
            : "border-ice/50 text-ice"
      }`}
    >
      {enCurso ? (
        <LoaderCircle aria-hidden className="mt-0.5 size-4 shrink-0 animate-spin" />
      ) : fase === "confirmada" ? (
        <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
      ) : (
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      )}
      <span>
        {FASES[fase]}
        {fase === "fallida" && error ? ` ${error}` : null}
      </span>
    </div>
  );
}

/** Espera mínima para que cada fase sea legible (el estado final lo da la API). */
export function pausa(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
