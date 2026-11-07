// Monto en pesos, monoespaciada (IBM Plex Mono) con formato es-AR.

import { formatARS } from "./domain";

export function MontoARS({
  cents,
  className = "",
  srLabel,
}: {
  cents: number;
  className?: string;
  srLabel?: string;
}) {
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {srLabel ? <span className="sr-only">{srLabel} </span> : null}
      {formatARS(cents)}
    </span>
  );
}
