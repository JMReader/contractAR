import type { Metadata } from "next";
import Link from "next/link";
import { EscrowSimulator } from "@/components/simulator/EscrowSimulator";

export const metadata: Metadata = {
  title: "Cómo funciona — ContractAR",
  description:
    "Acordás condiciones, la plata queda protegida y se libera o se devuelve según lo pactado. Con simulador interactivo.",
};

const STEPS = [
  {
    num: "01",
    title: "Acordás las condiciones",
    body: "Entre las dos partes definen el monto, qué tiene que pasar para cobrar y hasta cuándo. Todo queda escrito en el acuerdo antes de que se mueva un peso.",
  },
  {
    num: "02",
    title: "La plata queda protegida",
    body: "Quien paga deposita el monto en la garantía. Ni vos ni la otra parte lo pueden tocar hasta que se cumpla lo pactado.",
  },
  {
    num: "03",
    title: "Se libera o se devuelve",
    body: "Si las condiciones se cumplen, la plata se libera a quien cobraba. Si algo falla o el plazo vence, vuelve a quien la depositó.",
  },
];

const OUTCOMES = [
  "Si todo sale bien: la plata viaja a quien cobraba.",
  "Si el plazo vence sin acuerdo: la plata vuelve a quien la depositó.",
  "Si hay desacuerdo: un árbitro revisa y reparte según las reglas pactadas.",
];

export default function ComoFuncionaPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-20 sm:px-6">
      {/* Intro */}
      <header className="max-w-[640px] py-12 sm:py-16">
        <h1 className="text-[clamp(2rem,6vw,3.2rem)] font-extrabold leading-[1.08] tracking-[-0.03em] text-ink">
          Cómo funciona ContractAR
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          Un trato entre dos personas, con la plata protegida hasta que se
          cumpla lo pactado. Sin vueltas ni palabras raras.
        </p>
      </header>

      {/* Pasos */}
      <ol className="mb-14 grid grid-cols-1 gap-8 sm:mb-16 md:grid-cols-3 md:gap-6">
        {STEPS.map((step) => (
          <li key={step.num} className="border-t border-line pt-5">
            <span className="font-mono text-sm text-ice">{step.num}.</span>
            <h2 className="mt-2 text-lg font-semibold text-ink">{step.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      {/* Simulador */}
      <div className="mb-6 max-w-[560px]">
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Probá el flujo
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
          Este candado funciona igual que un acuerdo: cargá un monto, marcá qué
          condiciones se cumplieron y mirá qué pasa con la plata.
        </p>
      </div>
      <EscrowSimulator />

      {/* Qué pasa si… */}
      <section
        aria-labelledby="outcomes-heading"
        className="mt-14 max-w-[640px] sm:mt-16"
      >
        <h2
          id="outcomes-heading"
          className="text-xl font-semibold tracking-tight text-ink sm:text-2xl"
        >
          ¿Y después?
        </h2>
        <ul className="mt-4 space-y-3">
          {OUTCOMES.map((item) => (
            <li
              key={item}
              className="flex gap-3 text-sm leading-relaxed text-muted sm:text-base"
            >
              <span
                aria-hidden
                className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-ice"
              />
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-muted">
          En esta demo los pesos son de mentira. El mecanismo —aceptar,
          proteger, liberar o devolver— es el mismo que usa el acuerdo real.
        </p>
      </section>

      {/* CTA */}
      <div className="mt-12">
        <Link
          href="/acuerdos/nuevo"
          className="inline-flex min-h-[52px] items-center justify-center rounded-lg bg-blue px-8 font-semibold text-white transition-colors hover:bg-blue-bright active:bg-blue-bright"
        >
          Crear un acuerdo
        </Link>
      </div>
    </main>
  );
}
