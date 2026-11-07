"use client";

// Campo de copiado con feedback real (patrón "copy field" del design system).

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [msg, setMsg] = useState("");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      setMsg("Copiado al portapapeles");
    } catch {
      setMsg("No se pudo copiar: seleccioná el texto manualmente.");
    }
  }

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-[#7d8ba3] bg-bg px-3 py-2.5 font-mono text-sm text-ice">
          {value}
        </code>
        <button
          type="button"
          onClick={copiar}
          aria-label={label}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[#7d8ba3] bg-surface px-3 font-semibold text-ink"
        >
          <Copy aria-hidden className="size-4" />
          <span className="hidden sm:inline">Copiar</span>
        </button>
      </div>
      <p role="status" className="mt-1.5 min-h-5 text-sm text-green">
        {msg}
      </p>
    </div>
  );
}

export function CopiableMono({ value, label }: { value: string; label: string }) {
  const [ok, setOk] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(value);
      setOk(true);
      window.setTimeout(() => setOk(false), 2000);
    } catch {
      /* el texto queda visible para copiar a mano */
    }
  }
  return (
    <button
      type="button"
      onClick={copiar}
      aria-label={`${label}: copiar`}
      title="Tocar para copiar"
      className="inline-flex max-w-full items-center gap-1.5 rounded px-1 py-0.5 text-left font-mono text-xs text-ice"
    >
      <span className="truncate">{value}</span>
      {ok ? (
        <Check aria-hidden className="size-3.5 shrink-0 text-green" />
      ) : (
        <Copy aria-hidden className="size-3.5 shrink-0" />
      )}
    </button>
  );
}
