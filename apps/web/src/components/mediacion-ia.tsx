"use client";

// Mediación IA dentro de una disputa: la IA propone un reparto y el árbitro
// decide si lo aplica con la acción `rule` existente. Nunca firma sola.

import { useState } from "react";
import { toHumanError } from "@contractar/shared";
import {
  ApiError,
  agreementAction,
  getDemoUserId,
  mediateAgreement,
  type AgreementDetail,
  type MediationResult,
} from "@/lib/api";
import { useEjecutar } from "./use-ejecutar";
import { ConfirmDialog, type Confirmacion } from "./confirm-dialog";
import { TxStatus } from "./tx-status";
import { formatARS, PLANTILLAS } from "./domain";
import { DemoTag } from "./estado-pill";

const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-bold";
const btnPrimario = `${btn} bg-blue text-white`;
const btnSecundario = `${btn} border border-[#7d8ba3] text-ink`;

export function MediacionIA({
  id,
  detail,
  onCambio,
}: {
  id: string;
  detail: AgreementDetail;
  onCambio: () => Promise<unknown>;
}) {
  const [depositorEvidence, setDepositorEvidence] = useState("");
  const [beneficiaryEvidence, setBeneficiaryEvidence] = useState("");
  const [analizando, setAnalizando] = useState(false);
  const [analysisError, setAnalysisError] = useState<string>();
  const [resultado, setResultado] = useState<MediationResult | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [lauroHash, setLauroHash] = useState<string>();
  const { fase, error: errorTx, ejecutar } = useEjecutar();

  const p = PLANTILLAS[detail.template];
  const ruleAction = detail.actions.find((a) => a.action === "rule");
  const puedeAplicar = detail.yourRole === "arbiter" && (ruleAction?.enabled ?? true);
  const enCurso = analizando || fase === "firma" || fase === "enviada" || fase === "confirmando";

  async function analizar() {
    setAnalysisError(undefined);
    setResultado(null);
    if (!depositorEvidence.trim() || !beneficiaryEvidence.trim()) {
      setAnalysisError("Cargá la evidencia de las dos partes para analizar el caso.");
      return;
    }
    setAnalizando(true);
    try {
      const res = await mediateAgreement(id, {
        depositorEvidence: depositorEvidence.trim(),
        beneficiaryEvidence: beneficiaryEvidence.trim(),
      });
      setResultado(res);
    } catch (e) {
      setAnalysisError(e instanceof ApiError ? e.human : toHumanError(e));
    } finally {
      setAnalizando(false);
    }
  }

  function pedirAplicar() {
    if (!resultado) return;
    const toBen = resultado.recommendedToBeneficiaryCents;
    const toDep = resultado.recommendedToDepositorCents;
    setConfirmacion({
      titulo: "Aplicar el laudo recomendado",
      lineas: [
        { label: `Recibe ${p.rol.beneficiary.toLowerCase()}`, valor: formatARS(toBen) },
        { label: `Recupera ${p.rol.depositor.toLowerCase()}`, valor: formatARS(toDep) },
        { label: "Cargo del servicio (1%)", valor: formatARS(Math.floor(toBen / 100)) },
      ],
      efecto:
        "La recomendación de IA no decide: la aplicás vos como árbitro. El reparto es una transacción real en Fuji y cierra el acuerdo.",
      cta: "Aplicar laudo",
      peligrosa: true,
    });
  }

  async function confirmar() {
    if (!resultado) return;
    setOcupado(true);
    const res = await ejecutar(
      () =>
        agreementAction(id, {
          userId: getDemoUserId(),
          action: "rule",
          toBeneficiaryCents: resultado.recommendedToBeneficiaryCents,
          toDepositorCents: resultado.recommendedToDepositorCents,
        }),
      onCambio,
    );
    if (res?.txHash) setLauroHash(res.txHash);
    setOcupado(false);
    setConfirmacion(null);
  }

  return (
    <section
      aria-labelledby="mediacion-ia-t"
      className="rounded-xl border border-coral/60 bg-surface p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="mediacion-ia-t" className="text-lg font-bold">
          Mediación IA
        </h2>
        <DemoTag>Recomendación</DemoTag>
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        La IA propone cómo repartir el dinero retenido. No ejecuta pagos ni firma
        transacciones: la decisión final la toma el árbitro.
      </p>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="evidencia-depositor" className="mb-1.5 block text-sm font-semibold">
            Evidencia del depositante ({p.rol.depositor.toLowerCase()})
          </label>
          <textarea
            id="evidencia-depositor"
            value={depositorEvidence}
            onChange={(e) => setDepositorEvidence(e.target.value)}
            placeholder="Contá qué pasó, con hechos y comprobantes si los hay."
            className="min-h-24 w-full resize-y rounded-lg border border-[#7d8ba3] bg-bg px-3 py-2.5 placeholder:text-muted/70"
            disabled={enCurso}
          />
        </div>
        <div>
          <label htmlFor="evidencia-beneficiario" className="mb-1.5 block text-sm font-semibold">
            Evidencia del beneficiario ({p.rol.beneficiary.toLowerCase()})
          </label>
          <textarea
            id="evidencia-beneficiario"
            value={beneficiaryEvidence}
            onChange={(e) => setBeneficiaryEvidence(e.target.value)}
            placeholder="Contá qué pasó, con hechos y comprobantes si los hay."
            className="min-h-24 w-full resize-y rounded-lg border border-[#7d8ba3] bg-bg px-3 py-2.5 placeholder:text-muted/70"
            disabled={enCurso}
          />
        </div>
        <button
          type="button"
          onClick={() => void analizar()}
          disabled={enCurso}
          className={`${btnSecundario} w-full`}
        >
          {analizando ? "Analizando evidencia…" : "Analizar evidencia"}
        </button>
        {analysisError ? (
          <p role="alert" className="text-sm font-semibold text-coral">
            {analysisError}
          </p>
        ) : null}
      </div>

      {resultado ? (
        <div
          aria-live="polite"
          className="mt-5 rounded-lg border border-ice/50 bg-bg px-4 py-4 text-sm"
        >
          <p className="font-bold text-ice">
            Recomendación de IA. La decisión final la toma el árbitro.
          </p>
          <dl className="mt-3 space-y-1.5">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                {p.rol.beneficiary} · {resultado.toBeneficiaryPct}%
              </dt>
              <dd className="font-mono font-semibold">
                {formatARS(resultado.recommendedToBeneficiaryCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                {p.rol.depositor} · {resultado.toDepositorPct}%
              </dt>
              <dd className="font-mono font-semibold">
                {formatARS(resultado.recommendedToDepositorCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-1.5">
              <dt className="text-muted">Confianza</dt>
              <dd className="font-semibold capitalize">{resultado.confidence}</dd>
            </div>
          </dl>
          <p className="mt-3 leading-relaxed">{resultado.reasoning}</p>
          {resultado.evidenceMissing.length > 0 ? (
            <div className="mt-3">
              <p className="font-semibold">Falta evidencia:</p>
              <ul className="mt-1 list-inside list-disc text-muted">
                {resultado.evidenceMissing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {resultado.latencyMs !== undefined ? (
            <p className="mt-2 text-xs text-muted">
              {resultado.model ? `${resultado.model} · ` : ""}
              {(resultado.latencyMs / 1000).toFixed(1)} s
            </p>
          ) : null}

          {puedeAplicar ? (
            <button
              type="button"
              onClick={pedirAplicar}
              disabled={enCurso}
              className={`${btnPrimario} mt-4 w-full`}
            >
              El árbitro aplica el laudo
            </button>
          ) : (
            <p className="mt-4 rounded-lg border border-line px-3 py-2.5 text-muted">
              Sólo el árbitro designado puede aplicar este laudo.
            </p>
          )}

          {lauroHash ? (
            <p className="mt-3 break-all text-sm">
              Laudo aplicado. Hash:{" "}
              <a
                href={`https://testnet.snowtrace.io/tx/${lauroHash}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono font-semibold"
              >
                {lauroHash}
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      <TxStatus fase={fase} error={errorTx} />

      <ConfirmDialog
        confirmacion={confirmacion}
        ocupado={ocupado}
        onCancel={() => setConfirmacion(null)}
        onConfirm={() => void confirmar()}
      />
    </section>
  );
}
