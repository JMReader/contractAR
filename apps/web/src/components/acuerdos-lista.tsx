"use client";

// /acuerdos — lista del usuario: estado textual + monto ARS + próximo paso.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toHumanError } from "@contractar/shared";
import { ApiError, getDemoUserId, listAgreements, type AgreementSummary } from "@/lib/api";
import { estadoInfo, rolTexto, formatFecha } from "./domain";
import { EstadoPill, DemoTag } from "./estado-pill";
import { MontoARS } from "./monto-ars";
import { Cargando, ErrorVista } from "./estados-vista";

export function AcuerdosLista() {
  const [items, setItems] = useState<AgreementSummary[] | null>(null);
  const [error, setError] = useState<string>();
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const res = await listAgreements(getDemoUserId());
        if (!cancel) {
          setItems(res);
          setError(undefined);
        }
      } catch (e) {
        if (!cancel) {
          setItems([]);
          setError(e instanceof ApiError ? e.human : toHumanError(e));
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Tus acuerdos
          </h1>
          <p className="mt-1 text-muted">
            Plata protegida entre dos partes hasta que se cumpla lo pactado.{" "}
            <DemoTag>Simulación</DemoTag>
          </p>
        </div>
        <Link
          href="/acuerdos/nuevo"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue px-4 font-bold text-white no-underline"
        >
          <Plus aria-hidden className="size-5" />
          Nuevo acuerdo
        </Link>
      </div>

      <div className="mt-6">
        {items === null && !error ? <Cargando texto="Cargando tus acuerdos…" /> : null}

        {error ? (
          <ErrorVista mensaje={error} onReintentar={reintentar} />
        ) : null}

        {items !== null && items.length === 0 && !error ? (
          <div className="rounded-xl border border-line bg-surface p-6 text-center">
            <p className="font-bold">Todavía no tenés acuerdos.</p>
            <p className="mt-1 text-sm text-muted">
              Creá uno para una garantía de auto o la compra de una entrada y
              compartí el enlace con la otra parte.
            </p>
            <Link
              href="/acuerdos/nuevo"
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue px-4 font-bold text-white no-underline"
            >
              <Plus aria-hidden className="size-5" />
              Crear el primero
            </Link>
          </div>
        ) : null}

        {items && items.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((a) => {
              const est = estadoInfo(a.state);
              return (
                <li key={a.id}>
                  <Link
                    href={`/acuerdos/${a.id}`}
                    className="block rounded-xl border border-line bg-surface p-4 no-underline transition-colors hover:border-[#7d8ba3]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold leading-snug">{a.title}</p>
                      <EstadoPill estado={a.state} className="shrink-0" />
                    </div>
                    <p className="mt-3">
                      <MontoARS cents={a.amountCents} className="text-2xl font-bold" />
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {rolTexto(a.yourRole, a.template)}
                      {a.counterpartyLabel ? ` · con ${a.counterpartyLabel}` : ""}
                    </p>
                    {a.nextStep || est.detalle ? (
                      <p className="mt-2 text-sm font-semibold text-ice">
                        {a.nextStep ?? est.detalle}
                      </p>
                    ) : null}
                    {a.createdAt ? (
                      <p className="mt-2 text-xs text-muted">
                        Creado el {formatFecha(a.createdAt)}
                      </p>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </>
  );
}
