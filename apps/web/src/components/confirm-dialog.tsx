"use client";

// Diálogo de revisión previo a acciones de dinero (patrón "inline confirm").
// Nativo <dialog>: foco atrapado, Escape cierra, fondo con ::backdrop.

import { useEffect, useRef } from "react";

export interface Confirmacion {
  titulo: string;
  /** Líneas de revisión: "Monto — $ 600.000", "Recibe — La rentadora", etc. */
  lineas: { label: string; valor: string }[];
  efecto: string;
  cta: string;
  peligrosa?: boolean;
}

export function ConfirmDialog({
  confirmacion,
  onConfirm,
  onCancel,
  ocupado,
}: {
  confirmacion: Confirmacion | null;
  onConfirm: () => void;
  onCancel: () => void;
  ocupado: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const abierto = confirmacion !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (abierto && !el.open) el.showModal();
    if (!abierto && el.open) el.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      className="m-auto max-h-[85dvh] w-[min(92vw,26rem)] overflow-y-auto rounded-xl border border-line bg-surface-elevated p-0 text-ink backdrop:bg-black/60"
      aria-labelledby="confirm-titulo"
    >
      {confirmacion ? (
        <div className="p-5">
          <h2 id="confirm-titulo" className="text-lg font-bold tracking-tight">
            {confirmacion.titulo}
          </h2>
          <dl className="mt-4 space-y-2">
            {confirmacion.lineas.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-sm text-muted">{l.label}</dt>
                <dd className="text-right font-mono text-sm font-semibold">{l.valor}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-muted">{confirmacion.efecto}</p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={ocupado}
              className="min-h-11 rounded-lg border border-[#7d8ba3] px-4 font-semibold"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={ocupado}
              className={`min-h-11 rounded-lg px-4 font-bold text-white ${
                confirmacion.peligrosa ? "bg-[#b3402e]" : "bg-blue"
              }`}
            >
              {confirmacion.cta}
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
