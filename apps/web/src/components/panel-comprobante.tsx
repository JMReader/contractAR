// Panel técnico colapsable "Ver comprobante": lo único del producto que nombra
// direcciones, hashes y red. Todo etiquetado como datos de demostración.

import type { AgreementDetail } from "@/lib/api";
import { CopiableMono } from "./copy-field";
import { DemoTag } from "./estado-pill";

function Fila({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-40 shrink-0 text-sm text-muted">{label}</dt>
      <dd className="min-w-0">
        <CopiableMono value={value} label={label} />
      </dd>
    </div>
  );
}

export function PanelComprobante({ d }: { d: AgreementDetail }) {
  const hayDatos =
    d.termsHash || d.txHash || Object.keys(d.roleAddresses).length > 0 || d.network.escrow;

  return (
    <details className="group rounded-xl border border-line bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        <span>Ver comprobante</span>
        <span className="flex items-center gap-2">
          <DemoTag>Datos de demostración</DemoTag>
          <span aria-hidden className="text-muted transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="border-t border-line px-4 py-4">
        {!hayDatos ? (
          <p className="text-sm text-muted">
            Todavía no hay datos técnicos para este acuerdo. Cuando el operador de
            demostración registre la operación en la red de pruebas, acá vas a ver
            el comprobante verificable.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">
              Datos técnicos de la operación en la red de pruebas Avalanche Fuji
              {d.network.chainId ? ` (chain ${d.network.chainId})` : ""}. No
              necesitás entenderlos para usar el acuerdo.
            </p>
            <dl className="space-y-2.5">
              <Fila label="ID de acuerdo" value={d.id} />
              <Fila label="Hash de condiciones" value={d.termsHash} />
              <Fila label="Transacción" value={d.txHash} />
              <Fila label="Contrato" value={d.network.escrow} />
              <Fila label="Token de prueba" value={d.network.token} />
              <Fila label="Creador" value={d.roleAddresses.creator} />
              <Fila label="Depositante" value={d.roleAddresses.depositor} />
              <Fila label="Beneficiario" value={d.roleAddresses.beneficiary} />
              <Fila label="Árbitro" value={d.roleAddresses.arbiter} />
            </dl>
            {d.termsHashVerified !== null ? (
              <p className={`mt-4 text-sm font-semibold ${d.termsHashVerified ? "text-green" : "text-coral"}`}>
                {d.termsHashVerified
                  ? "Las condiciones mostradas coinciden con el hash registrado."
                  : "Atención: las condiciones no coinciden con el hash registrado."}
              </p>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}
