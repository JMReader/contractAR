"use client";

// Acciones disponibles según estado y rol. Cada acción de dinero pasa por
// revisión (ConfirmDialog) y muestra el ciclo de red completo (TxStatus).

import { useMemo, useState } from "react";
import Link from "next/link";
import { AgreementState, type Action } from "@contractar/shared";
import { agreementAction, type AgreementDetail } from "@/lib/api";
import { useEjecutar } from "./use-ejecutar";
import { ConfirmDialog, type Confirmacion } from "./confirm-dialog";
import { TxStatus } from "./tx-status";
import { formatARS, parseARStoCents, PLANTILLAS, vencioPlazo } from "./domain";
import { DemoTag } from "./estado-pill";

const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 font-bold";
const btnPrimario = `${btn} bg-blue text-white`;
const btnSecundario = `${btn} border border-[#7d8ba3] text-ink`;
const btnPeligro = `${btn} border border-coral text-coral`;

/** fee demo del contrato: 1% sobre la porción que se libera a quien cobra. */
const feeDe = (toBeneficiary: number) => Math.floor(toBeneficiary / 100);

export function AccionesAcuerdo({
  id,
  detail: d,
  userId,
  disponibleCents,
  onCambio,
}: {
  id: string;
  detail: AgreementDetail;
  userId: string;
  /** Saldo ARS disponible del usuario (para avisar antes de depositar). */
  disponibleCents: number | null;
  onCambio: () => Promise<unknown>;
}) {
  const { fase, error, ejecutar } = useEjecutar();
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [pendiente, setPendiente] = useState<(() => Promise<void>) | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // Formularios inline
  const [reparto, setReparto] = useState<"devolver" | "liberar" | "parcial">("devolver");
  const [montoParcial, setMontoParcial] = useState("");
  const [errorParcial, setErrorParcial] = useState<string>();
  const [motivo, setMotivo] = useState("");
  const [ruleBenef, setRuleBenef] = useState("");
  const [ruleDepos, setRuleDepos] = useState("");
  const [errorRule, setErrorRule] = useState<string>();

  const p = PLANTILLAS[d.template];
  const enCurso = fase === "firma" || fase === "enviada" || fase === "confirmando";
  const remaining = d.remainingCents;

  const apiAction = useMemo(
    () =>
      (action: Action): { enabled: boolean; reason?: string } => {
        const found = d.actions.find((a) => a.action === action);
        // Si la API no reporta esta acción, se decide localmente; si la reporta, manda ella.
        return found ? { enabled: found.enabled, reason: found.reason } : { enabled: true };
      },
    [d.actions],
  );

  function pedir(c: Confirmacion, fn: () => Promise<void>) {
    setConfirmacion(c);
    setPendiente(() => fn);
  }

  async function confirmar() {
    if (!pendiente) return;
    setOcupado(true);
    try {
      await pendiente();
    } finally {
      setOcupado(false);
      setConfirmacion(null);
      setPendiente(null);
    }
  }

  function run(accion: Action, extra?: Partial<Parameters<typeof agreementAction>[1]>) {
    return () =>
      ejecutar(
        () => agreementAction(id, { userId, action: accion, ...extra }),
        onCambio,
      ).then(() => undefined);
  }

  const lineasReparto = (toBenef: number) => [
    { label: `Recibe ${p.rol.beneficiary.toLowerCase()}`, valor: formatARS(toBenef) },
    { label: `Recupera ${p.rol.depositor.toLowerCase()}`, valor: formatARS(remaining - toBenef) },
    {
      label: "Cargo del servicio (1% de lo liberado)",
      valor: formatARS(feeDe(toBenef)),
    },
  ];

  const toBenefElegido =
    reparto === "devolver" ? 0 : reparto === "liberar" ? remaining : parseARStoCents(montoParcial) ?? -1;

  function revisarPropuesta() {
    if (reparto === "parcial" && (toBenefElegido < 0 || toBenefElegido > remaining)) {
      setErrorParcial(
        `Ingresá un monto mayor a $ 0 y que no supere ${formatARS(remaining)}.`,
      );
      return;
    }
    setErrorParcial(undefined);
    pedir(
      {
        titulo: "Revisá la propuesta de cierre",
        lineas: lineasReparto(toBenefElegido),
        efecto:
          "La otra parte va a ver este reparto y decide si lo acepta. Si lo acepta, el dinero se reparte solo y no se puede volver atrás.",
        cta: "Enviar propuesta",
      },
      run("proposeOutcome", { toBeneficiaryCents: toBenefElegido }),
    );
  }

  const sosParte = d.yourRole === "depositor" || d.yourRole === "beneficiary";
  const sosProposer =
    d.proposal?.proposerRole !== undefined && d.proposal.proposerRole === d.yourRole;
  const reviewVencido = vencioPlazo(d.deadlines.reviewAt);

  const propuestaAConfirmar = d.proposal
    ? {
        titulo: "Revisá la propuesta antes de aceptarla",
        lineas: lineasReparto(d.proposal.toBeneficiaryCents),
        efecto:
          "Al aceptarla, el dinero se reparte como se muestra y el acuerdo cierra. No se puede volver atrás.",
        cta: "Aceptar reparto",
      }
    : null;

  return (
    <section aria-label="Acciones del acuerdo" className="space-y-4">
      <p className="text-sm text-muted">
        Las acciones las firma el operador de demostración. <DemoTag>Simulación</DemoTag>
      </p>

      {/* CREATED — depositante revisa/acepta en la vista dedicada; creador cancela */}
      {d.state === AgreementState.Created && d.yourRole === "depositor" ? (
        <Link href={`/acuerdos/${id}/aceptar`} className={`${btnPrimario} w-full no-underline`}>
          Revisar y aceptar el acuerdo
        </Link>
      ) : null}

      {(d.state === AgreementState.Created || d.state === AgreementState.Accepted) &&
      d.yourRole === "creator" ? (
        <button
          type="button"
          disabled={enCurso || !apiAction("cancel").enabled}
          onClick={() =>
            pedir(
              {
                titulo: "Cancelar el acuerdo",
                lineas: [{ label: "Monto pactado", valor: formatARS(d.amountCents) }],
                efecto:
                  "El acuerdo queda cancelado y ya no puede aceptarse. No se movió dinero.",
                cta: "Cancelar acuerdo",
                peligrosa: true,
              },
              run("cancel"),
            )
          }
          className={btnPeligro}
        >
          Cancelar acuerdo
        </button>
      ) : null}

      {/* ACCEPTED — el depositante fondea */}
      {d.state === AgreementState.Accepted && d.yourRole === "depositor" ? (
        <div className="space-y-3">
          {disponibleCents !== null && disponibleCents < d.amountCents ? (
            <p role="note" className="rounded-lg border border-coral/60 px-3 py-2.5 text-sm">
              <span className="font-bold text-coral">Te falta saldo.</span>{" "}
              <span className="text-muted">
                Tenés {formatARS(disponibleCents)} disponibles y el depósito es{" "}
                {formatARS(d.amountCents)}.
              </span>{" "}
              <Link href="/saldo" className="font-semibold">
                Cargar saldo
              </Link>
            </p>
          ) : null}
          <button
            type="button"
            disabled={enCurso || !apiAction("fund").enabled}
            title={apiAction("fund").reason}
            onClick={() =>
              pedir(
                {
                  titulo: "Depositar el monto",
                  lineas: [
                    { label: "Depositás", valor: formatARS(d.amountCents) },
                    { label: "Queda protegido para", valor: d.title },
                  ],
                  efecto: `La plata sale de tu saldo y queda protegida en el acuerdo. Ninguna parte puede moverla sola: se libera cuando ambos acuerden el cierre, la devuelva un reclamo resuelto o venza el plazo.`,
                  cta: `Depositar ${formatARS(d.amountCents)}`,
                },
                run("fund"),
              )
            }
            className={`${btnPrimario} w-full`}
          >
            Depositar {formatARS(d.amountCents)}
          </button>
        </div>
      ) : null}

      {/* FUNDED / OUTCOME_PROPOSED — proponer cierre, aceptar propuesta, disputar */}
      {(d.state === AgreementState.Funded || d.state === AgreementState.OutcomeProposed) &&
      sosParte ? (
        <div className="space-y-4">
          {d.state === AgreementState.OutcomeProposed && d.proposal ? (
            <div className="rounded-lg border border-ice/50 bg-bg px-4 py-3">
              <p className="font-bold">
                Propuesta vigente
                {sosProposer ? " (la enviaste vos)" : ""}
              </p>
              <dl className="mt-2 space-y-1 text-sm">
                {lineasReparto(d.proposal.toBeneficiaryCents).map((l) => (
                  <div key={l.label} className="flex justify-between gap-3">
                    <dt className="text-muted">{l.label}</dt>
                    <dd className="font-mono">{l.valor}</dd>
                  </div>
                ))}
              </dl>
              {!sosProposer && propuestaAConfirmar ? (
                <button
                  type="button"
                  disabled={enCurso || !apiAction("acceptOutcome").enabled}
                  onClick={() => pedir(propuestaAConfirmar, run("acceptOutcome"))}
                  className={`${btnPrimario} mt-3 w-full`}
                >
                  Aceptar este reparto
                </button>
              ) : (
                <p className="mt-3 text-sm text-muted">
                  Esperando que la otra parte responda.
                </p>
              )}
            </div>
          ) : null}

          <fieldset className="rounded-lg border border-line px-4 py-3">
            <legend className="px-1 font-bold">Proponer cierre</legend>
            <div className="mt-1 space-y-2">
              {(
                [
                  ["devolver", `Devolver todo a ${p.rol.depositor.toLowerCase()}`],
                  ["liberar", `Liberar todo a ${p.rol.beneficiary.toLowerCase()}`],
                  ["parcial", "Otro reparto"],
                ] as const
              ).map(([valor, label]) => (
                <label
                  key={valor}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 font-semibold"
                >
                  <input
                    type="radio"
                    name="reparto"
                    value={valor}
                    checked={reparto === valor}
                    onChange={() => setReparto(valor)}
                    className="size-5 accent-[#0047ff]"
                  />
                  {label}
                </label>
              ))}
            </div>
            {reparto === "parcial" ? (
              <div className="mt-3">
                <label htmlFor="monto-parcial" className="mb-1.5 block text-sm font-semibold">
                  ¿Cuánto recibe {p.rol.beneficiary.toLowerCase()}? (en pesos)
                </label>
                <input
                  id="monto-parcial"
                  inputMode="decimal"
                  placeholder="Ej.: 180000"
                  value={montoParcial}
                  onChange={(e) => setMontoParcial(e.target.value)}
                  aria-invalid={errorParcial ? true : undefined}
                  aria-describedby={errorParcial ? "monto-parcial-error" : undefined}
                  className="min-h-11 w-full rounded-lg border border-[#7d8ba3] bg-bg px-3 py-2.5 font-mono aria-invalid:border-coral"
                />
                {errorParcial ? (
                  <p id="monto-parcial-error" role="alert" className="mt-1.5 text-sm font-semibold text-coral">
                    {errorParcial}
                  </p>
                ) : (
                  <p className="mt-1.5 text-sm text-muted">
                    El resto vuelve a {p.rol.depositor.toLowerCase()}. Máximo{" "}
                    {formatARS(remaining)}.
                  </p>
                )}
              </div>
            ) : null}
            <button
              type="button"
              disabled={enCurso || !apiAction("proposeOutcome").enabled}
              onClick={revisarPropuesta}
              className={`${btnSecundario} mt-3 w-full`}
            >
              Revisar propuesta
            </button>
          </fieldset>

          <div>
            <label htmlFor="motivo" className="mb-1.5 block text-sm font-semibold">
              ¿Qué pasó? (opcional)
            </label>
            <textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Contalo en una frase. Queda en el registro del reclamo."
              className="min-h-20 w-full resize-y rounded-lg border border-[#7d8ba3] bg-bg px-3 py-2.5 placeholder:text-muted/70"
            />
          </div>
          <button
            type="button"
            disabled={enCurso || !apiAction("dispute").enabled}
            onClick={() =>
              pedir(
                {
                  titulo: "Iniciar un reclamo",
                  lineas: [{ label: "Monto protegido", valor: formatARS(remaining) }],
                  efecto:
                    "Los fondos quedan congelados y un árbitro de demostración revisa el caso. Su decisión reparte el dinero y cierra el acuerdo.",
                  cta: "Iniciar reclamo",
                  peligrosa: true,
                },
                run("dispute", motivo.trim() ? { reason: motivo.trim() } : undefined),
              )
            }
            className={btnPeligro}
          >
            Iniciar un reclamo
          </button>

          {reviewVencido && d.yourRole === "depositor" ? (
            <button
              type="button"
              disabled={enCurso || !apiAction("refundAfterTimeout").enabled}
              onClick={() =>
                pedir(
                  {
                    titulo: "Reclamar la devolución",
                    lineas: [
                      { label: "Recuperás", valor: formatARS(remaining) },
                      { label: "Motivo", valor: "Plazo de revisión vencido" },
                    ],
                    efecto:
                      "Venció el plazo sin cierre acordado: el depósito vuelve entero a tu saldo, sin cargo.",
                    cta: "Reclamar devolución",
                  },
                  run("refundAfterTimeout"),
                )
              }
              className={btnPrimario}
            >
              Reclamar devolución por plazo vencido
            </button>
          ) : null}
        </div>
      ) : null}

      {/* DISPUTED — el árbitro demo resuelve; las partes esperan */}
      {d.state === AgreementState.Disputed ? (
        d.yourRole === "arbiter" ? (
          <div className="space-y-3 rounded-lg border border-coral/60 px-4 py-3">
            <p className="font-bold">Resolver la disputa (árbitro de demostración)</p>
            <p className="text-sm text-muted">
              Repartí {formatARS(remaining)} entre las partes. La suma tiene que ser
              exacta.
            </p>
            {(
              [
                ["rule-benef", `Para ${p.rol.beneficiary.toLowerCase()}`, ruleBenef, setRuleBenef],
                ["rule-depos", `Para ${p.rol.depositor.toLowerCase()}`, ruleDepos, setRuleDepos],
              ] as const
            ).map(([idF, label, valor, set]) => (
              <div key={idF}>
                <label htmlFor={idF} className="mb-1.5 block text-sm font-semibold">
                  {label} (en pesos)
                </label>
                <input
                  id={idF}
                  inputMode="decimal"
                  value={valor}
                  onChange={(e) => set(e.target.value)}
                  aria-invalid={errorRule ? true : undefined}
                  className="min-h-11 w-full rounded-lg border border-[#7d8ba3] bg-bg px-3 py-2.5 font-mono aria-invalid:border-coral"
                />
              </div>
            ))}
            {errorRule ? (
              <p role="alert" className="text-sm font-semibold text-coral">
                {errorRule}
              </p>
            ) : null}
            <button
              type="button"
              disabled={enCurso || !apiAction("rule").enabled}
              onClick={() => {
                const toBenef = parseARStoCents(ruleBenef) ?? -1;
                const toDepos = parseARStoCents(ruleDepos) ?? -1;
                if (toBenef < 0 || toDepos < 0 || toBenef + toDepos !== remaining) {
                  setErrorRule(
                    `Los dos montos tienen que sumar exactamente ${formatARS(remaining)}.`,
                  );
                  return;
                }
                setErrorRule(undefined);
                pedir(
                  {
                    titulo: "Resolver la disputa",
                    lineas: [
                      { label: `Recibe ${p.rol.beneficiary.toLowerCase()}`, valor: formatARS(toBenef) },
                      { label: `Recupera ${p.rol.depositor.toLowerCase()}`, valor: formatARS(toDepos) },
                      { label: "Cargo del servicio", valor: formatARS(feeDe(toBenef)) },
                    ],
                    efecto:
                      "Tu decisión reparte el dinero protegido y cierra el acuerdo. No se puede volver atrás.",
                    cta: "Resolver y repartir",
                    peligrosa: true,
                  },
                  run("rule", {
                    toBeneficiaryCents: toBenef,
                    toDepositorCents: toDepos,
                  }),
                );
              }}
              className={btnPeligro}
            >
              Resolver disputa
            </button>
          </div>
        ) : (
          <p className="rounded-lg border border-line px-4 py-3 text-sm text-muted">
            No hay acciones disponibles mientras el árbitro revisa. Los fondos
            siguen protegidos.
          </p>
        )
      ) : null}

      {d.state === AgreementState.Accepted && d.yourRole !== "depositor" ? (
        <p className="text-sm text-muted">
          Esperando que {p.rol.depositor.toLowerCase()} deposite el monto.
        </p>
      ) : null}
      {d.state === AgreementState.Created && d.yourRole === "beneficiary" ? (
        <p className="text-sm text-muted">
          Compartí el enlace de aceptación con {p.rol.depositor.toLowerCase()}.
        </p>
      ) : null}

      <TxStatus fase={fase} error={error} />

      <ConfirmDialog
        confirmacion={confirmacion}
        ocupado={ocupado}
        onCancel={() => {
          setConfirmacion(null);
          setPendiente(null);
        }}
        onConfirm={confirmar}
      />
    </section>
  );
}
