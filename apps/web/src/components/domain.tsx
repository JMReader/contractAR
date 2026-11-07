// Vocabulario de dominio para la UI: estados, roles, plantillas y próximos pasos.
// Todo en castellano rioplatense; nunca nombra token, wallet ni red.

import { AgreementState, Template, type Role } from "@contractar/shared";
import type { AgreementDetail } from "@/lib/api";

// ── Montos ────────────────────────────────────────────────────────────────────

const fmtEntero = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const fmtDecimos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Centavos ARS → "$ 600.000" / "$ 45.000,50". */
export function formatARS(cents: number): string {
  const pesos = cents / 100;
  return Number.isInteger(pesos) ? fmtEntero.format(pesos) : fmtDecimos.format(pesos);
}

/** "12.000" o "12000,50" → centavos. Devuelve null si no es entero positivo de centavos. */
export function parseARStoCents(input: string): number | null {
  const t = input.trim().replace(/\./g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function formatFecha(ms?: number): string {
  if (!ms) return "";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(ms));
}

// ── Estados ───────────────────────────────────────────────────────────────────

export type Tono = "neutro" | "activo" | "exito" | "alerta" | "error" | "demo";

export function estadoInfo(state: AgreementState): { label: string; tono: Tono; detalle: string } {
  switch (state) {
    case AgreementState.Created:
      return {
        label: "Pendiente de aceptación",
        tono: "activo",
        detalle: "La otra parte todavía no aceptó las condiciones.",
      };
    case AgreementState.Accepted:
      return {
        label: "Aceptado — falta el depósito",
        tono: "activo",
        detalle: "Las condiciones están aceptadas; falta depositar el monto.",
      };
    case AgreementState.Funded:
      return {
        label: "Fondos protegidos",
        tono: "exito",
        detalle: "El depósito quedó protegido. Ninguna parte puede moverlo sola.",
      };
    case AgreementState.OutcomeProposed:
      return {
        label: "Propuesta de cierre",
        tono: "activo",
        detalle: "Hay una propuesta de reparto esperando respuesta.",
      };
    case AgreementState.Disputed:
      return {
        label: "En disputa",
        tono: "alerta",
        detalle: "Un árbitro de demostración revisa el caso. Los fondos están congelados.",
      };
    case AgreementState.Settled:
    case AgreementState.Resolved:
      return { label: "Liquidado", tono: "neutro", detalle: "El acuerdo cerró y el dinero ya se repartió." };
    case AgreementState.Cancelled:
      return { label: "Cancelado", tono: "neutro", detalle: "El acuerdo se canceló antes de mover fondos." };
    default:
      return { label: "Sin datos", tono: "neutro", detalle: "" };
  }
}

export const TERMINALES: AgreementState[] = [
  AgreementState.Settled,
  AgreementState.Cancelled,
  AgreementState.Resolved,
];

export function esTerminal(state: AgreementState): boolean {
  return TERMINALES.includes(state);
}

/** ¿Venció este plazo (ms)? Helper de módulo: Date.now() fuera del render puro. */
export function vencioPlazo(ms?: number): boolean {
  return ms !== undefined && Date.now() > ms;
}

// ── Plantillas y roles ────────────────────────────────────────────────────────

export interface PlantillaInfo {
  nombre: string;
  descripcion: string;
  /** Labels por rol según la plantilla. */
  rol: Record<"creator" | "depositor" | "beneficiary", string>;
  quienDeposita: string;
  quePasaDespues: string;
}

export const PLANTILLAS: Record<Template, PlantillaInfo> = {
  [Template.Guarantee]: {
    nombre: "Garantía de auto",
    descripcion:
      "Quien alquila deja una garantía. Si no hay reclamos, la recupera entera; si hay un reclamo acordado, se descuenta esa parte.",
    rol: { creator: "Rentadora", depositor: "Cliente", beneficiary: "Rentadora" },
    quienDeposita: "el cliente (la otra parte)",
    quePasaDespues:
      "Cuando el cliente acepta, deposita la garantía y queda protegida hasta que ambos acuerden el cierre o se venza el plazo.",
  },
  [Template.Sale]: {
    nombre: "Compra de entrada",
    descripcion:
      "El comprador deposita el pago. Se libera al vendedor cuando el comprador confirma, o se devuelve si no se concreta.",
    rol: { creator: "Vendedor", depositor: "Comprador", beneficiary: "Vendedor" },
    quienDeposita: "el comprador (la otra parte)",
    quePasaDespues:
      "Cuando el comprador acepta, deposita el pago y queda protegido hasta que ambos acuerden el cierre o se venza el plazo.",
  },
};

export function rolTexto(role: Role | null, template: Template): string {
  const p = PLANTILLAS[template];
  switch (role) {
    case "creator":
      return `Creaste este acuerdo (${p.rol.creator.toLowerCase()})`;
    case "depositor":
      return `Sos ${p.rol.depositor.toLowerCase()} — depositás`;
    case "beneficiary":
      return `Sos ${p.rol.beneficiary.toLowerCase()} — cobrás`;
    case "arbiter":
      return "Sos el árbitro de demostración";
    default:
      return "Estás viendo este acuerdo como invitado";
  }
}

// ── Próximo paso ──────────────────────────────────────────────────────────────

export interface Paso {
  actor: string;
  texto: string;
}

/** Quién tiene la pelota, en lenguaje cotidiano. La acción exacta la dan los botones. */
export function proximoPaso(d: AgreementDetail): Paso | null {
  const p = PLANTILLAS[d.template];
  const acceptVencido = vencioPlazo(d.deadlines.acceptAt);
  const reviewVencido = vencioPlazo(d.deadlines.reviewAt);

  switch (d.state) {
    case AgreementState.Created:
      return acceptVencido
        ? { actor: "Nadie", texto: "Venció el plazo para aceptar. El acuerdo puede cancelarse." }
        : {
            actor: p.rol.depositor,
            texto: "Tiene que revisar las condiciones y aceptar para que el acuerdo siga adelante.",
          };
    case AgreementState.Accepted:
      return {
        actor: p.rol.depositor,
        texto: "Las condiciones están aceptadas. El siguiente paso es depositar el monto para protegerlo.",
      };
    case AgreementState.Funded:
      return reviewVencido
        ? {
            actor: p.rol.depositor,
            texto: "Se venció el plazo de revisión sin cierre acordado. Quien depositó puede reclamar la devolución.",
          }
        : {
            actor: "Cualquiera de las partes",
            texto: "Los fondos están protegidos. Propongan cómo cerrar el acuerdo o, si hay un problema, inicien un reclamo.",
          };
    case AgreementState.OutcomeProposed: {
      const propusoQuien =
        d.proposal?.proposerRole === "depositor" ? p.rol.depositor : p.rol.beneficiary;
      const otro =
        d.proposal?.proposerRole === "depositor" ? p.rol.beneficiary : p.rol.depositor;
      return {
        actor: otro,
        texto: `${propusoQuien} propuso cómo repartir el dinero. ${otro} tiene que aceptarla o proponer otra salida.`,
      };
    }
    case AgreementState.Disputed:
      return {
        actor: "Árbitro de demostración",
        texto: "El reclamo está en revisión. Cuando el árbitro resuelve, el reparto se ejecuta solo.",
      };
    case AgreementState.Settled:
    case AgreementState.Resolved:
      return { actor: "Cerrado", texto: "El dinero ya se repartió según lo acordado." };
    case AgreementState.Cancelled:
      return { actor: "Cerrado", texto: "El acuerdo quedó cancelado. No se movió dinero." };
    default:
      return null;
  }
}
