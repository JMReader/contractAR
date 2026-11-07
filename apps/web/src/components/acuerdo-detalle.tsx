"use client";

// /acuerdos/[id] — ficha: título+partes → monto → estado real → próximo paso y
// responsable → acciones → condiciones → cronología → comprobante colapsable.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgreementState, toHumanError } from "@contractar/shared";
import {
  ApiError,
  getAgreement,
  getDemoUserId,
  getLedger,
  type AgreementDetail,
} from "@/lib/api";
import { AccionesAcuerdo } from "./acciones-acuerdo";
import { Cronologia } from "./cronologia";
import { PanelComprobante } from "./panel-comprobante";
import { CopyField } from "./copy-field";
import { EstadoPill, DemoTag } from "./estado-pill";
import { MontoARS } from "./monto-ars";
import { Cargando, ErrorVista } from "./estados-vista";
import { esTerminal, estadoInfo, formatFecha, proximoPaso, rolTexto, PLANTILLAS } from "./domain";

export function AcuerdoDetalle({ id }: { id: string }) {
  const [d, setD] = useState<AgreementDetail | null>(null);
  const [error, setError] = useState<string>();
  const [disponible, setDisponible] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState(`/acuerdos/${id}/aceptar`);
  const [intento, setIntento] = useState(0);

  // Llamable desde eventos (post-acción): actualiza la ficha sin recargar.
  const cargar = useCallback(async () => {
    const uid = getDemoUserId();
    const det = await getAgreement(id, uid);
    setD(det);
    setError(undefined);
    if (det.yourRole === "depositor" || det.yourRole === null) {
      try {
        const l = await getLedger(uid);
        setDisponible(l.available);
      } catch {
        setDisponible(null);
      }
    }
  }, [id]);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        await cargar();
        if (!cancel) {
          setShareUrl(`${window.location.origin}/acuerdos/${id}/aceptar`);
        }
      } catch (e) {
        if (!cancel) {
          setError(e instanceof ApiError ? e.human : toHumanError(e));
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [cargar, id, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  if (error && !d) {
    return (
      <>
        <Volver />
        <div className="mt-6">
          <ErrorVista titulo="No pudimos abrir el acuerdo" mensaje={error} onReintentar={reintentar} />
        </div>
      </>
    );
  }
  if (!d) {
    return (
      <>
        <Volver />
        <Cargando texto="Abriendo el acuerdo…" />
      </>
    );
  }

  const p = PLANTILLAS[d.template];
  const est = estadoInfo(d.state);
  const paso = proximoPaso(d);

  return (
    <>
      <Volver />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">
            {p.nombre} {d.demo ? <DemoTag>Simulación</DemoTag> : null}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
            {d.title}
          </h1>
          <p className="mt-1.5 text-muted">
            {d.parties.creatorLabel} · {d.parties.counterpartyLabel} — {rolTexto(d.yourRole, d.template)}
          </p>
        </div>
        <EstadoPill estado={d.state} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Resumen: monto, estado, próximo paso, acciones — lateral en desktop */}
        <div className="space-y-4 lg:order-2">
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="text-sm font-semibold text-muted">Monto del acuerdo</p>
            <p className="mt-1">
              <MontoARS cents={d.amountCents} className="text-3xl font-extrabold" />
            </p>
            <p className="mt-2 text-sm text-muted">{est.detalle}</p>
            {d.state === AgreementState.Funded ||
            d.state === AgreementState.OutcomeProposed ||
            d.state === AgreementState.Disputed ? (
              <p className="mt-1 text-sm font-semibold text-green">
                Protegidos: <MontoARS cents={d.remainingCents} />
              </p>
            ) : null}
            {d.settlement ? (
              <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Recibió {p.rol.beneficiary.toLowerCase()}</dt>
                  <dd className="font-mono">{<MontoARS cents={d.settlement.toBeneficiaryCents} />}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Recuperó {p.rol.depositor.toLowerCase()}</dt>
                  <dd className="font-mono">{<MontoARS cents={d.settlement.toDepositorCents} />}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Cargo del servicio</dt>
                  <dd className="font-mono">{<MontoARS cents={d.settlement.feeCents} />}</dd>
                </div>
              </dl>
            ) : null}
          </div>

          {paso && !esTerminal(d.state) ? (
            <div className="rounded-xl border border-ice/50 bg-surface p-5">
              <p className="text-sm font-semibold text-muted">Próximo paso</p>
              <p className="mt-1 font-bold text-ice">Le toca a: {paso.actor}</p>
              <p className="mt-1 text-sm leading-relaxed">{paso.texto}</p>
            </div>
          ) : null}

          {!esTerminal(d.state) ? (
            <AccionesAcuerdo
              id={id}
              detail={d}
              userId={getDemoUserId()}
              disponibleCents={disponible}
              onCambio={cargar}
            />
          ) : null}

          {d.state === AgreementState.Created && d.yourRole !== "depositor" ? (
            <div className="rounded-xl border border-line bg-surface p-5">
              <p className="mb-2 text-sm font-bold">
                Enlace para que la otra parte revise y acepte
              </p>
              <CopyField value={shareUrl} label="Copiar enlace de aceptación" />
            </div>
          ) : null}
        </div>

        {/* Detalle: condiciones, plazos, cronología, comprobante */}
        <div className="space-y-6 lg:order-1">
          <section aria-labelledby="condiciones-t">
            <h2 id="condiciones-t" className="text-lg font-bold">
              Condiciones
            </h2>
            <div className="mt-2 rounded-xl border border-line bg-surface p-5">
              <p className="whitespace-pre-wrap leading-relaxed">
                {d.terms || "Sin condiciones registradas."}
              </p>
              {d.termsHashVerified === false ? (
                <p role="alert" className="mt-3 text-sm font-bold text-coral">
                  Atención: estas condiciones no coinciden con lo registrado. No
                  aceptes hasta verificarlo con la otra parte.
                </p>
              ) : null}
            </div>
          </section>

          {d.deadlines.acceptAt || d.deadlines.reviewAt ? (
            <section aria-labelledby="plazos-t">
              <h2 id="plazos-t" className="text-lg font-bold">
                Plazos
              </h2>
              <dl className="mt-2 space-y-2 rounded-xl border border-line bg-surface p-5 text-sm">
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
            </section>
          ) : null}

          <section aria-labelledby="cronologia-t">
            <h2 id="cronologia-t" className="text-lg font-bold">
              Cronología
            </h2>
            <div className="mt-2 rounded-xl border border-line bg-surface p-5">
              <Cronologia eventos={d.timeline} />
            </div>
          </section>

          <PanelComprobante d={d} />
        </div>
      </div>
    </>
  );
}

function Volver() {
  return (
    <Link
      href="/acuerdos"
      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-muted no-underline"
    >
      <ArrowLeft aria-hidden className="size-4" /> Tus acuerdos
    </Link>
  );
}
