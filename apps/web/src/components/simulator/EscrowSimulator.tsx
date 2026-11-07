"use client";

import { useState } from "react";
import {
  Lock,
  LockOpen,
  Plus,
  Trash2,
  CircleCheck,
  Clock,
  RotateCcw,
  Info,
} from "lucide-react";

/* Arte ASCII portado de InteractiveVaultSimulator (Octa / CriteriaLock),
   etiquetas traducidas y tercera variante para la devolución. */
const CUSTODIA_ART = [
  "      . · : = + * # % @ % # * + = : · .      ",
  "    · : + # @ @ @ @ @ @ @ @ @ @ # + : ·    ",
  "   : + # @ @ ┌───────────────┐ @ @ # + :   ",
  "   + # @ @   │   ╭───────╮   │   @ @ # +   ",
  "   * # @ @   │   │  ███  │   │   @ @ # *   ",
  "   # @ @ ┌───┴───┴───────┴───┴───┐ @ @ #   ",
  "   % @ @ │    [ PROTEGIDA ]     │ @ @ %   ",
  "   @ @ @ │      ╭─────────╮      │ @ @ @   ",
  "   % @ @ │      │   (●)   │      │ @ @ %   ",
  "   # @ @ │      ╰───┬─┬───╯      │ @ @ #   ",
  "   * # @ └──────────┴─┴──────────┘ @ # *   ",
  "    · : + # % @ @ @ @ @ @ @ @ % # + : ·    ",
];

const LIBERADA_ART = [
  "    * + # @ ·                     · @ # + *    ",
  "  + # @ ·         ╭───────╮         · @ # +  ",
  " : # @            │       │            @ # : ",
  " + @     ┌────────┘       │              @ + ",
  " * @     │                │              @ * ",
  " # @ ┌───┴────────────────┴──────┐       @ # ",
  " % @ │       [ LIBERADA ]        │       @ % ",
  " @ @ │        ╭─────────╮        │       @ @ ",
  " % @ │        │   (✓)   │        │       @ % ",
  " # @ │        ╰─────────╯        │       @ # ",
  " * # └───────────────────────────┘       # * ",
  "   · : = + * # % @ @ @ @ @ % # * + = : ·   ",
];

const DEVUELTA_ART = [
  "    * + # @ ·                     · @ # + *    ",
  "  + # @ ·         ╭───────╮         · @ # +  ",
  " : # @            │       │            @ # : ",
  " + @     ┌────────┘       │              @ + ",
  " * @     │                │              @ * ",
  " # @ ┌───┴────────────────┴──────┐       @ # ",
  " % @ │       [ DEVUELTA ]        │       @ % ",
  " @ @ │        ╭─────────╮        │       @ @ ",
  " % @ │        │   (<<)  │        │       @ % ",
  " # @ │        ╰─────────╯        │       @ # ",
  " * # └───────────────────────────┘       # * ",
  "   · : = + * # % @ @ @ @ @ % # * + = : ·   ",
];

type RuleStatus = "pending" | "verifying" | "verified";
type Outcome = "custodia" | "liberada" | "devuelta";

interface ReleaseRule {
  id: string;
  title: string;
  tag: string;
  status: RuleStatus;
}

const DEFAULT_RULES: ReleaseRule[] = [
  {
    id: "regla-acuerdo",
    title: "Las dos partes aceptaron las condiciones",
    tag: "Acuerdo",
    status: "verified",
  },
  {
    id: "regla-deposito",
    title: "El depósito quedó protegido en la garantía",
    tag: "Custodia",
    status: "verified",
  },
  {
    id: "regla-entrega",
    title: "Se confirmó la entrega dentro del plazo",
    tag: "Entrega",
    status: "pending",
  },
];

const STATUS_COPY: Record<
  Outcome,
  { art: string[]; label: string; artLabel: string; tone: string }
> = {
  custodia: {
    art: CUSTODIA_ART,
    label: "Plata protegida — nadie la puede tocar",
    artLabel: "Candado cerrado: la plata está protegida",
    tone: "text-ice",
  },
  liberada: {
    art: LIBERADA_ART,
    label: "Plata liberada a quien cobraba",
    artLabel: "Candado abierto: la plata fue liberada",
    tone: "text-green",
  },
  devuelta: {
    art: DEVUELTA_ART,
    label: "Plata devuelta a quien la depositó",
    artLabel: "Candado abierto: la plata volvió al depositante",
    tone: "text-coral",
  },
};

function formatARS(numeric: number): string {
  return numeric.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export function EscrowSimulator() {
  const [amount, setAmount] = useState("850000");
  const [concept, setConcept] = useState("Compra de entrada entre particulares");
  const [rules, setRules] = useState<ReleaseRule[]>(DEFAULT_RULES);
  const [customRule, setCustomRule] = useState("");
  const [outcome, setOutcome] = useState<Outcome>("custodia");
  const [processing, setProcessing] = useState<"liberar" | "devolver" | null>(
    null
  );

  const numeric = parseInt(amount, 10) || 0;
  const verifiedCount = rules.filter((r) => r.status === "verified").length;
  const isTerminal = outcome !== "custodia";
  const busy = processing !== null;
  const status = STATUS_COPY[outcome];

  const handleAmountChange = (raw: string) => {
    setAmount(raw.replace(/[^\d]/g, "").slice(0, 12));
  };

  const toggleRule = (id: string) => {
    if (busy || isTerminal) return;
    setRules((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: r.status === "verified" ? "pending" : "verified" }
          : r
      )
    );
  };

  const deleteRule = (id: string) => {
    if (busy || isTerminal) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const addRule = (e: React.FormEvent) => {
    e.preventDefault();
    const title = customRule.trim();
    if (!title || busy || isTerminal) return;
    setRules((prev) => [
      ...prev,
      {
        id: `regla-${Date.now()}`,
        title,
        tag: "Regla",
        status: "pending",
      },
    ]);
    setCustomRule("");
  };

  const simulateRelease = () => {
    if (busy || isTerminal || rules.length === 0) return;
    setProcessing("liberar");
    setRules((prev) =>
      prev.map((r) => (r.status === "pending" ? { ...r, status: "verifying" } : r))
    );
    setTimeout(() => {
      setRules((prev) => prev.map((r) => ({ ...r, status: "verified" })));
      setOutcome("liberada");
      setProcessing(null);
    }, 900);
  };

  const simulateRefund = () => {
    if (busy || isTerminal || rules.length === 0) return;
    setProcessing("devolver");
    setTimeout(() => {
      setOutcome("devuelta");
      setProcessing(null);
    }, 700);
  };

  const reset = () => {
    if (busy) return;
    setRules(DEFAULT_RULES.map((r) => ({ ...r })));
    setOutcome("custodia");
  };

  return (
    <section
      aria-labelledby="simulator-heading"
      className="w-full rounded-xl border border-line bg-surface p-4 sm:p-8"
    >
      {/* Etiqueta permanente de simulación */}
      <p
        role="note"
        className="mb-6 flex items-center gap-2.5 rounded-lg border border-line bg-bg px-4 py-3 font-mono text-xs sm:text-sm text-ice"
      >
        <Info className="h-4 w-4 shrink-0" aria-hidden />
        Simulación — no mueve dinero real
      </p>

      <div className="mb-8 flex items-end justify-between gap-4">
        <h2
          id="simulator-heading"
          className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
        >
          Candado del acuerdo
        </h2>
        <button
          type="button"
          onClick={reset}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 font-mono text-xs text-muted transition-colors hover:text-ink active:text-ink"
        >
          <RotateCcw className="h-3.5 w-3.5 text-ice" aria-hidden />
          Reiniciar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
        {/* Columna izquierda: candado + monto + concepto */}
        <div className="flex flex-col lg:col-span-5">
          <div className="mb-8 flex flex-col items-center border-b border-line pb-6">
            <pre
              role="img"
              aria-label={status.artLabel}
              className={`select-none font-mono text-[10px] leading-[1.3] transition-colors duration-300 sm:text-xs ${
                outcome === "custodia" ? "text-blue-bright" : status.tone
              }`}
            >
              {status.art.join("\n")}
            </pre>
            <p
              aria-live="polite"
              className={`mt-4 inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm ${status.tone}`}
            >
              {outcome === "custodia" ? (
                <Lock className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <LockOpen className="h-3.5 w-3.5" aria-hidden />
              )}
              {status.label} ({verifiedCount}/{rules.length})
            </p>
          </div>

          <div className="mb-6 border-b border-line pb-6">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label
                htmlFor="sim-amount-input"
                className="font-mono text-xs uppercase text-muted"
              >
                Monto a proteger
              </label>
              <span className="font-mono text-xs text-ice">pesos · ejemplo</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden
                className="select-none font-mono text-3xl font-semibold text-blue-bright sm:text-4xl"
              >
                $
              </span>
              <input
                id="sim-amount-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                disabled={isTerminal}
                className="w-full min-w-0 bg-transparent font-mono text-4xl font-bold tracking-tight text-ink tabular-nums disabled:opacity-60 sm:text-5xl"
              />
            </div>
            <p className="mt-1 text-xs text-muted">ARS — monto de la simulación</p>
          </div>

          <div>
            <label
              htmlFor="sim-concept-input"
              className="mb-2 block font-mono text-xs uppercase text-muted"
            >
              Concepto del acuerdo
            </label>
            <input
              id="sim-concept-input"
              type="text"
              maxLength={70}
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              disabled={isTerminal}
              className="min-h-[44px] w-full border-b border-muted bg-transparent py-2 text-base text-ink transition-colors focus:border-ice disabled:opacity-60"
            />
          </div>
        </div>

        {/* Columna derecha: reglas de liberación + acciones */}
        <div className="flex flex-col lg:col-span-7">
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-4">
            <h3 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">
              Condiciones para liberar el pago
            </h3>
            <span className="shrink-0 font-mono text-xs text-ice tabular-nums">
              {verifiedCount} de {rules.length}
            </span>
          </div>

          <ul className="mb-6 divide-y divide-line">
            {rules.map((rule) => {
              const isVerified = rule.status === "verified";
              const isVerifying = rule.status === "verifying";
              const stateText = isVerified
                ? "cumplida"
                : isVerifying
                  ? "verificando"
                  : "pendiente";
              return (
                <li key={rule.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleRule(rule.id)}
                    disabled={busy || isTerminal}
                    aria-pressed={isVerified}
                    className="group flex min-h-[56px] flex-1 items-center gap-3 py-3 text-left disabled:opacity-80 sm:gap-4"
                  >
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                        isVerified
                          ? "bg-blue text-white"
                          : isVerifying
                            ? "text-coral"
                            : "border border-muted text-muted group-hover:border-ink group-hover:text-ink"
                      }`}
                    >
                      {isVerified ? (
                        <CircleCheck className="h-4.5 w-4.5" aria-hidden />
                      ) : isVerifying ? (
                        <span
                          className="h-4 w-4 animate-spin rounded-full border-2 border-coral border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-base sm:text-lg ${
                          isVerified ? "font-medium text-ink" : "text-muted"
                        }`}
                      >
                        {rule.title}
                      </span>
                      <span className="sr-only">Condición {stateText}</span>
                    </span>
                    <span className="hidden shrink-0 rounded-full border border-line bg-bg px-2.5 py-1 font-mono text-xs text-muted sm:inline-block">
                      {rule.tag}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule(rule.id)}
                    disabled={busy || isTerminal}
                    aria-label={`Eliminar condición: ${rule.title}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-coral active:text-coral"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          {rules.length === 0 && (
            <p className="mb-6 text-sm text-muted">
              Sin condiciones no hay liberación: sumá al menos una para seguir.
            </p>
          )}

          <form
            onSubmit={addRule}
            className="mb-8 flex items-end gap-3 border-b border-line pb-8"
          >
            <div className="min-w-0 flex-1">
              <label
                htmlFor="sim-new-rule"
                className="mb-1 block font-mono text-xs uppercase text-muted"
              >
                Sumar condición
              </label>
              <input
                id="sim-new-rule"
                type="text"
                value={customRule}
                onChange={(e) => setCustomRule(e.target.value)}
                disabled={busy || isTerminal}
                placeholder="Ej. Entrega de llaves confirmada"
                maxLength={70}
                className="min-h-[44px] w-full border-b border-muted bg-transparent py-2 text-sm text-ink transition-colors placeholder:text-muted focus:border-ice disabled:opacity-60"
              />
            </div>
            <button
              type="submit"
              disabled={!customRule.trim() || busy || isTerminal}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-muted px-4 text-sm text-ink transition-colors hover:border-ink active:border-ink"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Sumar
            </button>
          </form>

          {isTerminal ? (
            <div className="flex flex-col gap-3">
              <p
                aria-live="polite"
                className={`font-mono text-sm ${status.tone}`}
              >
                {outcome === "liberada"
                  ? "Se cumplieron las condiciones: la plata viajó a quien cobraba."
                  : "No se cumplió lo pactado: la plata volvió a quien la depositó."}
              </p>
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg bg-blue px-6 font-semibold text-white transition-colors hover:bg-blue-bright active:bg-blue-bright"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reiniciar simulación
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={simulateRelease}
                disabled={busy || rules.length === 0}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-lg bg-blue px-6 font-semibold text-white transition-colors hover:bg-blue-bright active:bg-blue-bright"
              >
                {processing === "liberar"
                  ? "Verificando condiciones…"
                  : `Simular liberación de $ ${formatARS(numeric)}`}
              </button>
              <button
                type="button"
                onClick={simulateRefund}
                disabled={busy || rules.length === 0}
                className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-lg border border-muted px-6 font-semibold text-ink transition-colors hover:border-ink active:border-ink"
              >
                {processing === "devolver"
                  ? "Devolviendo…"
                  : "Simular devolución"}
              </button>
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-muted">
            En el acuerdo real, liberar y devolver son acciones firmadas por las
            partes o resueltas por un árbitro. Acá todo es de mentira: tocá,
            tachá y volvé a probar.
          </p>
        </div>
      </div>
    </section>
  );
}
