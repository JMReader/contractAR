"use client";

// Estados de datos: carga con texto, error con causa y acción, vacío con próximo
// paso (R-27 de antislop — nunca un spinner mudo ni "sin datos").

import { LoaderCircle, TriangleAlert } from "lucide-react";

export function Cargando({ texto }: { texto: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-muted">
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      <p>{texto}</p>
    </div>
  );
}

export function ErrorVista({
  titulo = "No pudimos cargar",
  mensaje,
  onReintentar,
}: {
  titulo?: string;
  mensaje: string;
  onReintentar?: () => void;
}) {
  return (
    <div className="rounded-xl border border-coral/60 bg-surface p-5" role="alert">
      <p className="flex items-center gap-2 font-bold text-coral">
        <TriangleAlert aria-hidden className="size-5" />
        {titulo}
      </p>
      <p className="mt-2 text-sm text-muted">{mensaje}</p>
      {onReintentar ? (
        <button
          type="button"
          onClick={onReintentar}
          className="mt-4 min-h-11 rounded-lg border border-[#7d8ba3] px-4 font-semibold"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
