"use client";

// /acuerdos/[id]/aceptar — vista de la contraparte: qué acepta, quién deposita,
// qué pasa después. Consentimiento explícito: checkbox sin marcar y botón
// deshabilitado hasta tildarlo (ningún consentimiento se premarca).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AgreementState, toHumanError } from "@contractar/shared";
import { Check, ShieldCheck } from "lucide-react";
import {
  agreementAction,
  ApiError,
  getAgreement,
  getDemoUserId,
  type AgreementDetail,
} from "@/lib/api";
import { useEjecutar } from "./use-ejecutar";
import { TxStatus } from "./tx-status";
import { EstadoPill, DemoTag } from "./estado-pill";
import { MontoARS } from "./monto-ars";
import { Cargando, ErrorVista } from "./estados-vista";
import { formatARS, formatFecha, PLANTILLAS } from "./domain";

export function AceptarAcuerdo({ id }: { id: string }) {
  const [d, setD] = useState<AgreementDetail | null>(null);
  const [error, setError] = useState<string>();
  const [acepto, setAcepto] = useState(false);
  const [hecho, setHecho] = useState(false);
  const { fase, error: errorAccion, ejecutar } = useEjecutar();

  const [intento, setIntento] = useState(0);

  const cargar = useCallback(async () => {
    const det = await getAgreement(id, getDemoUserId());
    setD(det);
    setError(undefined);
  }, [id]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        await cargar();
      } catch (e) {
        if (!cancel) {
          setError(e instanceof ApiError ? e.human : toHumanError(e));
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [cargar, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  if (error && !d) {
    return (
      <div className="mt-6">
        <ErrorVista titulo="No pudimos abrir el enlace" mensaje={error} onReintentar={reintentar} />
      </div>
    );
  }
  if (!d) return <Cargando texto="Abriendo el acuerdo que te compartieron…" />;

  const p = PLANTILLAS[d.template];
  const enCurso = fase === "firma" || fase === "enviada" || fase === "confirmando";
  const aceptable = d.state === AgreementState.Created;

  async function aceptar() {
    const res = await ejecutar(
      () => agreementAction(id, { userId: getDemoUserId(), action: "accept" }),
      cargar,
    );
    if (res) setHecho(true);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold text-muted">
        Te compartieron un acuerdo {d.demo ? <DemoTag>Simulación</DemoTag> : null}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{d.title}</h1>
        <EstadoPill estado={d.state} />
      </div>

      {hecho ? (
        <div className="mt-6 rounded-xl border border-green/60 bg-surface p-6 text-center">
          <Check aria-hidden className="mx-auto size-8 text-green" />
          <p className="mt-2 text-lg font-bold">Aceptaste el acuerdo</p>
          <p className="mt-1 text-sm text-muted">
            El siguiente paso es depositar {formatARS(d.amountCents)}. Lo vas a hacer desde
            la ficha del acuerdo, con tu saldo.
          </p>
          <Link
            href={`/acuerdos/${id}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-blue px-5 font-bold text-white no-underline"
          >
            Ir a la ficha del acuerdo
          </Link>
        </div>
      ) : !aceptable ? (
        <div className="mt-6 rounded-xl border border-line bg-surface p-6">
          <p className="font-bold">Este enlace ya no está pendiente de aceptación.</p>
          <p className="mt-1 text-sm text-muted">
            El acuerdo ya avanzó o se cerró. Podés ver su estado actual en la ficha.
          </p>
          <Link
            href={`/acuerdos/${id}`}
            className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[#7d8ba3] px-5 font-bold no-underline"
          >
            Ver la ficha
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="que-acepta">
            <h2 id="que-acepta" className="font-bold">
              Qué aceptás
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Quien propone</dt>
                <dd className="font-semibold">{d.parties.creatorLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Vos sos</dt>
                <dd className="font-semibold">{d.parties.counterpartyLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Depositás</dt>
                <dd><MontoARS cents={d.amountCents} className="text-base font-bold" /></dd>
              </div>
              {d.deadlines.acceptAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Aceptar antes de</dt>
                  <dd className="font-semibold">{formatFecha(d.deadlines.acceptAt)}</dd>
                </div>
              ) : null}
              {d.deadlines.reviewAt ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Completar antes de</dt>
                  <dd className="font-semibold">{formatFecha(d.deadlines.reviewAt)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm font-bold">Condiciones</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {d.terms || "Sin condiciones registradas."}
              </p>
            </div>
            {d.termsHashVerified === false ? (
              <p role="alert" className="mt-3 text-sm font-bold text-coral">
                Atención: estas condiciones no coinciden con lo registrado.
                Verificalo con la otra parte antes de aceptar.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="despues">
            <h2 id="despues" className="font-bold">
              Qué pasa después de aceptar
            </h2>
            <ol className="mt-3 space-y-3">
              {[
                `Depositás ${formatARS(d.amountCents)} desde tu saldo.`,
                `La plata queda protegida: ninguna parte puede moverla sola.`,
                `Al cierre, se reparte según lo acordado entre las dos partes. Las devoluciones no tienen cargo; sobre lo liberado a quien cobra hay un 1% de cargo de servicio.`,
              ].map((t, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-ice font-mono text-xs font-bold text-ice"
                  >
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
            <p className="mt-3 flex items-start gap-2 text-sm text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-green" />
              {p.quePasaDespues}
            </p>
          </section>

          <div className="rounded-xl border border-line bg-surface p-5">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 font-semibold leading-snug">
              <input
                type="checkbox"
                checked={acepto}
                onChange={(e) => setAcepto(e.target.checked)}
                className="mt-1 size-5 shrink-0 accent-[#0047ff]"
              />
              <span>
                Leí las condiciones y acepto el acuerdo por{" "}
                <MontoARS cents={d.amountCents} />.
              </span>
            </label>
            <button
              type="button"
              disabled={!acepto || enCurso}
              onClick={aceptar}
              className="mt-4 min-h-12 w-full rounded-lg bg-blue px-4 text-base font-bold text-white"
            >
              Aceptar el acuerdo
            </button>
            {!acepto ? (
              <p className="mt-2 text-center text-sm text-muted">
                El botón se habilita cuando marcás que leíste y aceptás.
              </p>
            ) : null}
            <TxStatus fase={fase} error={errorAccion} />
          </div>
        </div>
      )}
    </div>
  );
}
