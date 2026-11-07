"use client";

// /acuerdos/nuevo — crear acuerdo: plantilla, título, contraparte, monto ARS,
// condiciones y plazos. Validación accesible (errores junto al campo, role=alert).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CarFront, Ticket } from "lucide-react";
import { Template } from "@contractar/shared";
import {
  createAgreement,
  getDemoUserId,
  type CreateAgreementInput,
} from "@/lib/api";
import { useEjecutar } from "./use-ejecutar";
import { TxStatus } from "./tx-status";
import { FormField, FormArea } from "./form-field";
import { PLANTILLAS, formatARS, parseARStoCents } from "./domain";
import { DemoTag } from "./estado-pill";

const ICONO_PLANTILLA = {
  [Template.Guarantee]: CarFront,
  [Template.Sale]: Ticket,
} as const;

const AYUDA_CONDICIONES: Record<Template, string> = {
  [Template.Guarantee]:
    "Ej.: la garantía se devuelve entera si el auto vuelve sin daños nuevos. Reclamos con fotos hasta 48 h después de la devolución.",
  [Template.Sale]:
    "Ej.: el pago se libera al vendedor cuando el comprador confirma que la entrada funcionó. Si el evento se cancela, devolución completa.",
};

const DIA = 24 * 60 * 60;

type Campo = "titulo" | "contraparte" | "monto" | "plazoAceptar" | "plazoRevision" | "condiciones";
type Errores = Partial<Record<Campo, string>>;

/** ids deterministas: foco del primer error sin refs en render. */
const IDS: Record<Campo, string> = {
  titulo: "campo-titulo",
  contraparte: "campo-contraparte",
  monto: "campo-monto",
  plazoAceptar: "campo-plazo-aceptar",
  plazoRevision: "campo-plazo-revision",
  condiciones: "campo-condiciones",
};

/** Construye el payload en módulo: Date.now() fuera del render del componente. */
function crearInput(campos: {
  template: Template;
  titulo: string;
  contraparte: string;
  montoCents: number;
  condiciones: string;
  diasAceptar: string;
  diasRevision: string;
}): CreateAgreementInput {
  const now = Math.floor(Date.now() / 1000);
  return {
    userId: getDemoUserId(),
    template: campos.template,
    title: campos.titulo.trim(),
    counterpartyLabel: campos.contraparte.trim(),
    amountCents: campos.montoCents,
    terms: campos.condiciones.trim(),
    acceptDeadlineSec: now + Number(campos.diasAceptar) * DIA,
    reviewDeadlineSec: now + Number(campos.diasRevision) * DIA,
  };
}

export function AcuerdoForm() {
  const router = useRouter();
  const { fase, error, ejecutar } = useEjecutar();
  const [template, setTemplate] = useState<Template>(Template.Guarantee);
  const [titulo, setTitulo] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [monto, setMonto] = useState("");
  const [diasAceptar, setDiasAceptar] = useState("3");
  const [diasRevision, setDiasRevision] = useState("14");
  const [condiciones, setCondiciones] = useState("");
  const [errores, setErrores] = useState<Errores>({});

  const p = PLANTILLAS[template];
  const enCurso = fase === "firma" || fase === "enviada" || fase === "confirmando";
  const montoCents = parseARStoCents(monto);

  function validar(): Errores {
    const e: Errores = {};
    if (titulo.trim().length < 3) e.titulo = "Ponele un título de al menos 3 letras.";
    if (!contraparte.trim()) e.contraparte = "Indicá quién es la otra parte.";
    if (montoCents === null) e.monto = "Ingresá un monto en pesos, mayor a $ 0.";
    const aceptar = Number(diasAceptar);
    const revision = Number(diasRevision);
    if (!Number.isInteger(aceptar) || aceptar < 1 || aceptar > 60)
      e.plazoAceptar = "Entre 1 y 60 días.";
    if (!Number.isInteger(revision) || revision < 1 || revision > 365)
      e.plazoRevision = "Entre 1 y 365 días.";
    if (condiciones.trim().length < 10)
      e.condiciones = "Escribí las condiciones en al menos una frase.";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validar();
    setErrores(e);
    const primero = (Object.keys(e) as Campo[])[0];
    if (primero) {
      document.getElementById(IDS[primero])?.focus();
      return;
    }
    const res = await ejecutar(() =>
      createAgreement(
        crearInput({
          template,
          titulo,
          contraparte,
          montoCents: montoCents ?? 0,
          condiciones,
          diasAceptar,
          diasRevision,
        }),
      ),
    );
    if (res?.id) router.push(`/acuerdos/${res.id}`);
  }

  return (
    <>
      <Link
        href="/acuerdos"
        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-muted no-underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Tus acuerdos
      </Link>

      <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        Nuevo acuerdo
      </h1>
      <p className="mt-1 text-muted">
        Definí las condiciones; la otra parte las revisa antes de aceptar.{" "}
        <DemoTag>Simulación</DemoTag>
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 max-w-2xl space-y-6">
        <fieldset>
          <legend className="font-bold">¿Qué querés acordar?</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2" role="group" aria-label="Plantilla">
            {([Template.Guarantee, Template.Sale] as const).map((t) => {
              const Icon = ICONO_PLANTILLA[t];
              const sel = template === t;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={sel}
                  onClick={() => setTemplate(t)}
                  className={`min-h-11 rounded-xl border p-4 text-left transition-colors ${
                    sel
                      ? "border-ice bg-surface-elevated"
                      : "border-line bg-surface"
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold">
                    <Icon aria-hidden className={`size-5 ${sel ? "text-ice" : "text-muted"}`} />
                    {PLANTILLAS[t].nombre}
                  </span>
                  <span className="mt-1.5 block text-sm leading-snug text-muted">
                    {PLANTILLAS[t].descripcion}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <FormField
          id={IDS.titulo}
          label="Título del acuerdo"
          required
          maxLength={70}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          error={errores.titulo}
          placeholder={
            template === Template.Guarantee
              ? "Ej.: Garantía por el Corsa del fin de semana"
              : "Ej.: Entrada para el recital del sábado"
          }
        />

        <FormField
          id={IDS.contraparte}
          label={
            template === Template.Guarantee
              ? "¿Quién es el cliente? (deposita la garantía)"
              : "¿Quién es el comprador? (deposita el pago)"
          }
          required
          maxLength={70}
          value={contraparte}
          onChange={(e) => setContraparte(e.target.value)}
          error={errores.contraparte}
          placeholder="Nombre o contacto — dato de demostración"
          ayuda="Es un dato de la demo: la otra parte entra por el enlace que le compartas."
        />

        <FormField
          id={IDS.monto}
          label="Monto en pesos"
          required
          inputMode="decimal"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          error={errores.monto}
          placeholder="Ej.: 600.000"
          ayuda={montoCents !== null ? `Se registra como ${formatARS(montoCents)}.` : undefined}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id={IDS.plazoAceptar}
            label="Días para aceptar"
            required
            inputMode="numeric"
            type="number"
            min={1}
            max={60}
            value={diasAceptar}
            onChange={(e) => setDiasAceptar(e.target.value)}
            error={errores.plazoAceptar}
            ayuda="Si no acepta en este plazo, el acuerdo puede cancelarse."
          />
          <FormField
            id={IDS.plazoRevision}
            label="Días para completar"
            required
            inputMode="numeric"
            type="number"
            min={1}
            max={365}
            value={diasRevision}
            onChange={(e) => setDiasRevision(e.target.value)}
            error={errores.plazoRevision}
            ayuda="Vencido este plazo sin acuerdo, quien depositó puede reclamar la devolución."
          />
        </div>

        <FormArea
          id={IDS.condiciones}
          label="Condiciones"
          required
          maxLength={2000}
          value={condiciones}
          onChange={(e) => setCondiciones(e.target.value)}
          error={errores.condiciones}
          placeholder={AYUDA_CONDICIONES[template]}
          ayuda="Quedan registradas con el acuerdo: la otra parte acepta exactamente lo que escribas acá."
        />

        <div className="rounded-xl border border-line bg-surface p-4 text-sm">
          <p className="font-bold">Cómo sigue</p>
          <p className="mt-1 text-muted">
            Vos sos {p.rol.creator.toLowerCase()}; deposita {p.quienDeposita}.{" "}
            {p.quePasaDespues} El cargo del servicio es 1% sobre lo que se libere a
            quien cobra; las devoluciones no tienen cargo.
          </p>
        </div>

        <button
          type="submit"
          disabled={enCurso}
          className="min-h-12 w-full rounded-lg bg-blue px-4 text-base font-bold text-white"
        >
          Crear acuerdo
        </button>
        <TxStatus fase={fase} error={error} />
      </form>
    </>
  );
}
