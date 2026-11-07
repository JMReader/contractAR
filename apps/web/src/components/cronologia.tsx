// Cronología del acuerdo: eventos reales con fecha (y hash en el comprobante).

import { formatFecha } from "./domain";
import type { TimelineEntry } from "@/lib/api";

export function Cronologia({ eventos }: { eventos: TimelineEntry[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-muted text-sm">
        Todavía no hay eventos registrados. La cronología se completa a medida que
        el acuerdo avanza.
      </p>
    );
  }
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {eventos.map((e, i) => (
        <li key={`${e.label}-${i}`} className="relative">
          <span
            aria-hidden
            className={`absolute -left-[26px] top-1.5 size-3 rounded-full border-2 border-bg ${
              i === eventos.length - 1 ? "bg-ice" : "bg-[#7d8ba3]"
            }`}
          />
          <p className="font-semibold leading-snug">{e.label}</p>
          {e.at ? <p className="text-muted text-sm">{formatFecha(e.at)}</p> : null}
        </li>
      ))}
    </ol>
  );
}
