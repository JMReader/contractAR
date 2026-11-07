"use client";

// /saldo — disponible / en garantía / retirando. Carga y retiro SIMULADOS
// (Mock MP): toda la pantalla está etiquetada como demo; nunca se insinúa
// una transferencia bancaria real.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { toHumanError, type LedgerBalance, type PaymentStatus } from "@contractar/shared";
import {
  ApiError,
  getDemoUserId,
  getLedger,
  getPayment,
  loadPayment,
  newIdempotencyKey,
  resolvePayment,
  withdrawPayment,
} from "@/lib/api";
import { useEjecutar } from "./use-ejecutar";
import { TxStatus } from "./tx-status";
import { DemoTag } from "./estado-pill";
import { MontoARS } from "./monto-ars";
import { Cargando, ErrorVista } from "./estados-vista";
import { formatARS, parseARStoCents } from "./domain";

const inputCls =
  "min-h-11 w-full rounded-lg border border-[#7d8ba3] bg-bg px-3 py-2.5 font-mono text-ink placeholder:text-muted/70 aria-invalid:border-coral";
const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-bold";

type EstadoCarga =
  | { fase: "idle" }
  | { fase: "pendiente"; paymentId: string; monto: number }
  | { fase: "resolviendo" }
  | { fase: "final"; status: PaymentStatus; mensaje: string };

export function SaldoView() {
  const [ledger, setLedger] = useState<LedgerBalance | null>(null);
  const [error, setError] = useState<string>();
  const [uid, setUid] = useState("");

  const [montoCarga, setMontoCarga] = useState("");
  const [errorCarga, setErrorCarga] = useState<string>();
  const [carga, setCarga] = useState<EstadoCarga>({ fase: "idle" });

  const [montoRetiro, setMontoRetiro] = useState("");
  const [errorRetiro, setErrorRetiro] = useState<string>();
  const retiro = useEjecutar();
  const cargaInicial = useEjecutar();

  const [intento, setIntento] = useState(0);

  // Llamable desde eventos (tras un pago/retiro): relee el ledger.
  const refrescar = useCallback(async () => {
    const id = getDemoUserId();
    const l = await getLedger(id);
    setUid(id);
    setLedger(l);
    setError(undefined);
  }, []);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        await refrescar();
      } catch (e) {
        if (!cancel) {
          setError(e instanceof ApiError ? e.human : toHumanError(e));
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [refrescar, intento]);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  async function cargarSaldo(ev: React.FormEvent) {
    ev.preventDefault();
    const cents = parseARStoCents(montoCarga);
    if (cents === null) {
      setErrorCarga("Ingresá un monto en pesos, mayor a $ 0.");
      return;
    }
    setErrorCarga(undefined);
    const res = await cargaInicial.ejecutar(() =>
      loadPayment({
        userId: getDemoUserId(),
        amountCents: cents,
        idempotencyKey: newIdempotencyKey(),
      }),
    );
    if (res?.paymentId) {
      setCarga({ fase: "pendiente", paymentId: res.paymentId, monto: cents });
    }
  }

  async function simular(outcome: "approved" | "rejected") {
    if (carga.fase !== "pendiente") return;
    setCarga({ fase: "resolviendo" });
    try {
      await resolvePayment(carga.paymentId, outcome);
      const pago = await getPayment(carga.paymentId);
      await refrescar();
      setCarga({
        fase: "final",
        status: pago.status,
        mensaje:
          pago.status === "approved"
            ? `Pago aprobado: se acreditaron ${formatARS(carga.monto)} a tu saldo.`
            : pago.status === "rejected"
              ? "El pago simulado fue rechazado: no se acreditó saldo."
              : `Estado del pago: ${pago.status}.`,
      });
    } catch (e) {
      setCarga({
        fase: "final",
        status: "rejected",
        mensaje: e instanceof ApiError ? e.human : toHumanError(e),
      });
    }
  }

  async function retirar(ev: React.FormEvent) {
    ev.preventDefault();
    const cents = parseARStoCents(montoRetiro);
    if (cents === null) {
      setErrorRetiro("Ingresá un monto en pesos, mayor a $ 0.");
      return;
    }
    if (ledger && cents > ledger.available) {
      setErrorRetiro(
        `Sólo podés retirar tu saldo disponible (${formatARS(ledger.available)}). Lo que está protegido en acuerdos no se puede retirar.`,
      );
      return;
    }
    setErrorRetiro(undefined);
    const res = await retiro.ejecutar(
      () =>
        withdrawPayment({
          userId: getDemoUserId(),
          amountCents: cents,
          idempotencyKey: newIdempotencyKey(),
        }),
      refrescar,
    );
    if (res) setMontoRetiro("");
  }

  const cargando = ledger === null && !error;

  return (
    <>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Tu saldo</h1>
        <p className="mt-1 text-muted">
          Pesos de demostración para cargar y retirar.{" "}
          <DemoTag>Demo: carga y retiro simulados</DemoTag>
        </p>
      </div>

      <p role="note" className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
        Nada de esto mueve dinero real: la carga simula un pago con Mercado Pago
        y el retiro simula la salida a tu cuenta. Lo que está protegido en un
        acuerdo no se puede retirar.
      </p>

      {cargando ? <Cargando texto="Leyendo tu saldo…" /> : null}
      {error ? <div className="mt-4"><ErrorVista mensaje={error} onReintentar={reintentar} /></div> : null}

      {ledger ? (
        <>
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Disponible", ledger.available, "Se puede usar para depositar o retirar."],
                ["En garantía", ledger.inEscrow, "Protegido en acuerdos; no se puede retirar."],
                ["Retirando", ledger.withdrawing, "Salidas simuladas en curso."],
              ] as const
            ).map(([label, valor, ayuda]) => (
              <div key={label} className="rounded-xl border border-line bg-surface p-4">
                <dt className="text-sm font-semibold text-muted">{label}</dt>
                <dd className="mt-1">
                  <MontoARS cents={valor} className="text-2xl font-extrabold" />
                </dd>
                <dd className="mt-1 text-xs leading-snug text-muted">{ayuda}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {/* ── Cargar ── */}
            <section aria-labelledby="cargar-t" className="rounded-xl border border-line bg-surface p-5">
              <h2 id="cargar-t" className="flex items-center gap-2 text-lg font-bold">
                <ArrowDownToLine aria-hidden className="size-5 text-ice" />
                Cargar saldo
              </h2>
              <p className="mt-1 text-sm text-muted">
                Simulación de un pago con Mercado Pago. Vos elegís el resultado.
              </p>
              <form onSubmit={cargarSaldo} noValidate className="mt-4 space-y-3">
                <div>
                  <label htmlFor="monto-carga" className="mb-1.5 block text-sm font-semibold">
                    Monto a cargar (en pesos)
                  </label>
                  <input
                    id="monto-carga"
                    inputMode="decimal"
                    placeholder="Ej.: 600.000"
                    value={montoCarga}
                    onChange={(e) => setMontoCarga(e.target.value)}
                    aria-invalid={errorCarga ? true : undefined}
                    aria-describedby={errorCarga ? "monto-carga-error" : undefined}
                    className={inputCls}
                  />
                  {errorCarga ? (
                    <p id="monto-carga-error" role="alert" className="mt-1.5 text-sm font-semibold text-coral">
                      {errorCarga}
                    </p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={cargaInicial.fase === "firma" || cargaInicial.fase === "enviada" || cargaInicial.fase === "confirmando" || carga.fase === "pendiente" || carga.fase === "resolviendo"}
                  className={`${btn} w-full bg-blue text-white`}
                >
                  Cargar saldo (simulado)
                </button>
                <TxStatus fase={cargaInicial.fase} error={cargaInicial.error} />
              </form>

              {carga.fase === "pendiente" ? (
                <div className="mt-4 rounded-lg border border-ice/50 bg-bg p-4" role="status">
                  <p className="font-bold">
                    Pago simulado pendiente: <MontoARS cents={carga.monto} />
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    En la demo no hay procesador real: elegí cómo termina el pago.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => simular("approved")}
                      className={`${btn} bg-blue text-white`}
                    >
                      Simular pago aprobado
                    </button>
                    <button
                      type="button"
                      onClick={() => simular("rejected")}
                      className={`${btn} border border-coral text-coral`}
                    >
                      Simular pago rechazado
                    </button>
                  </div>
                </div>
              ) : null}
              {carga.fase === "resolviendo" ? (
                <p role="status" className="mt-4 text-sm font-semibold text-ice">
                  Esperando el resultado del procesador simulado…
                </p>
              ) : null}
              {carga.fase === "final" ? (
                <p
                  role="status"
                  className={`mt-4 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                    carga.status === "approved"
                      ? "border-green/60 text-green"
                      : "border-coral/60 text-coral"
                  }`}
                >
                  {carga.mensaje}
                </p>
              ) : null}
            </section>

            {/* ── Retirar ── */}
            <section aria-labelledby="retirar-t" className="rounded-xl border border-line bg-surface p-5">
              <h2 id="retirar-t" className="flex items-center gap-2 text-lg font-bold">
                <ArrowUpFromLine aria-hidden className="size-5 text-ice" />
                Retirar
              </h2>
              <p className="mt-1 text-sm text-muted">
                Salida simulada a tu cuenta. Sólo sobre el saldo disponible.
              </p>
              <form onSubmit={retirar} noValidate className="mt-4 space-y-3">
                <div>
                  <label htmlFor="monto-retiro" className="mb-1.5 block text-sm font-semibold">
                    Monto a retirar (en pesos)
                  </label>
                  <input
                    id="monto-retiro"
                    inputMode="decimal"
                    placeholder={ledger.available > 0 ? `Hasta ${formatARS(ledger.available)}` : "Ej.: 50.000"}
                    value={montoRetiro}
                    onChange={(e) => setMontoRetiro(e.target.value)}
                    aria-invalid={errorRetiro ? true : undefined}
                    aria-describedby={errorRetiro ? "monto-retiro-error" : undefined}
                    className={inputCls}
                  />
                  {errorRetiro ? (
                    <p id="monto-retiro-error" role="alert" className="mt-1.5 text-sm font-semibold text-coral">
                      {errorRetiro}
                    </p>
                  ) : null}
                </div>
                <button
                  type="submit"
                  disabled={retiro.fase === "firma" || retiro.fase === "enviada" || retiro.fase === "confirmando" || ledger.available <= 0}
                  className={`${btn} w-full border border-[#7d8ba3]`}
                >
                  Retirar a mi cuenta (simulado)
                </button>
                {ledger.available <= 0 ? (
                  <p className="text-sm text-muted">
                    No tenés saldo disponible para retirar.{" "}
                    <Link href="/acuerdos" className="font-semibold">
                      Ver tus acuerdos
                    </Link>
                  </p>
                ) : null}
                <TxStatus fase={retiro.fase} error={retiro.error} />
              </form>
            </section>
          </div>

          <p className="mt-8 text-xs text-muted">
            Sesión de demostración: <span className="font-mono">{uid}</span>. Las
            operaciones las procesa un operador de demo; el comprobante técnico de
            cada acuerdo muestra sus datos reales de la red de pruebas cuando
            existen.
          </p>
        </>
      ) : null}
    </>
  );
}
