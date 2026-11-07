// Vocabulario de dominio en castellano rioplatense: estados, plantillas, roles,
// próximo paso y acciones por rol. Nunca nombra token, wallet ni red.
// Espejo de apps/web/src/components/domain.tsx adaptado a la app.

import type { Action, AgreementDetail, Role, State, Template } from "./api";

// ── Montos y fechas ──────────────────────────────────────────────────────────

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

/** "12.000" / "12000,50" → centavos. null si no es entero positivo de centavos. */
export function parseARStoCents(input: string): number | null {
  const t = input.trim().replace(/\./g, "").replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

const fmtFecha = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatFecha(ms?: number): string {
  return ms ? fmtFecha.format(new Date(ms)) : "";
}

// ── Estados ──────────────────────────────────────────────────────────────────

export type Tono = "neutro" | "activo" | "exito" | "alerta";

export function estadoInfo(state: State): { label: string; tono: Tono } {
  switch (state) {
    case "Created":
      return { label: "Pendiente de aceptación", tono: "activo" };
    case "Accepted":
      return { label: "Aceptado, falta el depósito", tono: "activo" };
    case "Funded":
      return { label: "Fondos protegidos", tono: "exito" };
    case "Delivered":
      return { label: "Entrega confirmada", tono: "activo" };
    case "OutcomeProposed":
      return { label: "Propuesta de cierre", tono: "activo" };
    case "Disputed":
      return { label: "En disputa", tono: "alerta" };
    case "Settled":
    case "Resolved":
    case "Completed":
      return { label: "Liquidado", tono: "neutro" };
    case "Cancelled":
      return { label: "Cancelado", tono: "neutro" };
    default:
      return { label: "Sin datos", tono: "neutro" };
  }
}

const TERMINALES: State[] = ["Settled", "Cancelled", "Resolved", "Completed"];
export const esTerminal = (s: State) => TERMINALES.includes(s);
export const vencio = (ms?: number) => ms !== undefined && Date.now() > ms;

// ── Plantillas y roles ───────────────────────────────────────────────────────

export interface PlantillaInfo {
  nombre: string;
  descripcion: string;
  icono: "auto" | "entrada";
  rol: Record<"creator" | "depositor" | "beneficiary", string>;
  quienDeposita: string;
  condicionesEj: string;
}

export const PLANTILLAS: Record<Template, PlantillaInfo> = {
  guarantee: {
    nombre: "Garantía de auto",
    icono: "auto",
    descripcion:
      "Quien alquila deja una garantía. Si no hay reclamos, la recupera entera; si hay un reclamo acordado, se descuenta esa parte.",
    rol: { creator: "Rentadora", depositor: "Cliente", beneficiary: "Rentadora" },
    quienDeposita: "el cliente (la otra parte)",
    condicionesEj:
      "Ej.: la garantía se devuelve entera si el auto vuelve sin daños nuevos. Reclamos con fotos hasta 48 h después de la devolución.",
  },
  sale: {
    nombre: "Compra de entrada",
    icono: "entrada",
    descripcion:
      "El comprador deposita el pago. Se libera al vendedor cuando el comprador confirma, o se devuelve si no se concreta.",
    rol: { creator: "Vendedor", depositor: "Comprador", beneficiary: "Vendedor" },
    quienDeposita: "el comprador (la otra parte)",
    condicionesEj:
      "Ej.: el pago se libera al vendedor cuando el comprador confirma que la entrada funcionó. Si el evento se cancela, devolución completa.",
  },
};

/** Rol en una palabra para la lista ("cliente", "vendedor", "árbitro"). */
export function rolCorto(role: Role | null, template: Template): string {
  if (role === "arbiter") return "árbitro";
  if (!role) return "invitado";
  return PLANTILLAS[template].rol[role].toLowerCase();
}

export function rolTexto(role: Role | null, template: Template): string {
  const p = PLANTILLAS[template];
  switch (role) {
    case "creator":
      return `Sos ${p.rol.creator.toLowerCase()}: proponés el acuerdo y cobrás`;
    case "depositor":
      return `Sos ${p.rol.depositor.toLowerCase()}: depositás`;
    case "beneficiary":
      return `Sos ${p.rol.beneficiary.toLowerCase()}: cobrás`;
    case "arbiter":
      return "Sos el árbitro de demostración";
    default:
      return "Estás viendo este acuerdo como invitado";
  }
}

// ── Próximo paso ─────────────────────────────────────────────────────────────

export function proximoPaso(d: AgreementDetail): string | null {
  const p = PLANTILLAS[d.template];
  switch (d.state) {
    case "Created":
      return vencio(d.deadlines.acceptAt)
        ? "Venció el plazo para aceptar: el acuerdo puede cancelarse."
        : `${p.rol.depositor} tiene que revisar las condiciones y aceptar desde el enlace.`;
    case "Accepted":
      return `Las condiciones están aceptadas. ${p.rol.depositor} deposita el monto para protegerlo.`;
    case "Funded":
      return vencio(d.deadlines.reviewAt)
        ? `Se venció el plazo sin cierre acordado. ${p.rol.depositor} puede reclamar la devolución.`
        : "Los fondos están protegidos. Propongan cómo cerrar o, si hay un problema, inicien un reclamo.";
    case "Delivered":
      return "La entrega está confirmada. Falta cerrar el reparto del dinero.";
    case "OutcomeProposed": {
      const propusoDepositor = d.proposerUserId === d.roles.depositor.userId;
      const propuso = propusoDepositor ? p.rol.depositor : p.rol.beneficiary;
      const otro = propusoDepositor ? p.rol.beneficiary : p.rol.depositor;
      return `${propuso} propuso cómo repartir el dinero. ${otro} tiene que aceptarla o proponer otra salida.`;
    }
    case "Disputed":
      return "Un árbitro de demostración revisa el reclamo. Los fondos siguen protegidos.";
    case "Settled":
    case "Resolved":
    case "Completed":
      return "El acuerdo cerró y el dinero ya se repartió.";
    case "Cancelled":
      return "El acuerdo quedó cancelado. No se movió dinero.";
    default:
      return null;
  }
}

/** Próximo paso corto para la lista (sin deadlines, sólo estado). */
export function pasoCorto(state: State): string {
  switch (state) {
    case "Created":
      return "Esperando que la otra parte acepte";
    case "Accepted":
      return "Esperando el depósito";
    case "Funded":
      return "Definir el cierre o reclamar";
    case "Delivered":
      return "Entrega confirmada, falta el cierre";
    case "OutcomeProposed":
      return "Hay una propuesta esperando respuesta";
    case "Disputed":
      return "Árbitro de demostración revisando";
    case "Settled":
    case "Resolved":
    case "Completed":
      return "Repartido";
    case "Cancelled":
      return "Cancelado";
    default:
      return "";
  }
}

// ── Acciones disponibles (fallback local: el server hoy no devuelve actions[]) ─
// Reglas espejo de applyAction() en apps/web/src/lib/server/agreements.ts.

export interface AccionUI {
  action: Action;
  titulo: string;
  /** 'money' exige hoja de revisión con monto; 'peligro' confirma inline. */
  kind: "money" | "peligro" | "simple";
}

/**
 * ¿El server habilita la acción? Sin listado del server (endpoints viejos),
 * se usa la lógica local. Si el server la reporta, es autoritativa.
 */
export function habilitada(d: AgreementDetail, action: Action): boolean {
  if (!d.actions) return true;
  return d.actions.find((a) => a.action === action)?.enabled ?? false;
}

export function accionesPara(d: AgreementDetail): AccionUI[] {
  const role = d.yourRole;
  const out: AccionUI[] = [];
  const soyParte = role === "depositor" || role === "beneficiary";
  const propuseYo = d.proposerUserId !== undefined && d.proposerUserId !== null &&
    ((role === "depositor" && d.proposerUserId === d.roles.depositor.userId) ||
      (role === "beneficiary" && d.proposerUserId === d.roles.beneficiary.userId));

  switch (d.state) {
    case "Created":
      if (role === "creator")
        out.push({ action: "cancel", titulo: "Cancelar acuerdo", kind: "peligro" });
      if (role === "depositor")
        out.push({ action: "accept", titulo: "Aceptar las condiciones", kind: "money" });
      break;
    case "Accepted":
      if (role === "creator")
        out.push({ action: "cancel", titulo: "Cancelar acuerdo", kind: "peligro" });
      if (role === "depositor")
        out.push({ action: "fund", titulo: `Depositar ${formatARS(d.remainingCents)}`, kind: "money" });
      break;
    case "Funded":
    case "Delivered":
      if (soyParte) {
        out.push({ action: "dispute", titulo: "Iniciar un reclamo", kind: "peligro" });
        if (role === "depositor" && vencio(d.deadlines.reviewAt))
          out.push({ action: "refundAfterTimeout", titulo: "Reclamar devolución", kind: "money" });
      }
      break;
    case "OutcomeProposed":
      if (soyParte) {
        if (!propuseYo && d.proposedToBeneficiaryCents !== undefined)
          out.push({ action: "acceptOutcome", titulo: "Aceptar el reparto propuesto", kind: "money" });
        out.push({ action: "dispute", titulo: "Iniciar un reclamo", kind: "peligro" });
        if (role === "depositor" && vencio(d.deadlines.reviewAt))
          out.push({ action: "refundAfterTimeout", titulo: "Reclamar devolución", kind: "money" });
      }
      break;
    case "Disputed":
      if (role === "arbiter")
        out.push({ action: "rule", titulo: "Resolver la disputa", kind: "money" });
      break;
    default:
      break;
  }
  // El server es autoritativo cuando reporta disponibilidad.
  return out.filter((a) => habilitada(d, a.action));
}

// ── Cronología (derivada de estado + txHashes; el server no devuelve timeline) ─

export interface PasoCronologia {
  label: string;
  done: boolean;
  actual: boolean;
  txHash?: string;
}

export function cronologia(d: AgreementDetail): PasoCronologia[] {
  const tx = d.onchain.txHashes;
  const s = d.state;
  const pasos: PasoCronologia[] = [
    {
      label: "Acordado",
      done: true,
      actual: s === "Created",
      txHash: tx.create,
    },
    {
      label: "Aceptado por la otra parte",
      done: s !== "Created" && s !== "Cancelled" && s !== "None",
      actual: s === "Accepted",
      txHash: tx.accepted ?? tx.accept,
    },
    {
      label: "Fondos protegidos",
      done:
        s === "Funded" ||
        s === "Delivered" ||
        s === "OutcomeProposed" ||
        s === "Disputed" ||
        s === "Settled" ||
        s === "Resolved" ||
        s === "Completed",
      actual: s === "Funded" || s === "Delivered",
      txHash: tx.fund,
    },
    {
      label: "Cierre",
      done: s === "Settled" || s === "Resolved" || s === "Completed",
      actual: s === "OutcomeProposed" || s === "Disputed",
      txHash: tx.acceptOutcome ?? tx.rule ?? tx.settle ?? tx.refundAfterTimeout,
    },
  ];
  if (s === "Cancelled") {
    pasos[pasos.length - 1] = { label: "Cancelado", done: true, actual: true, txHash: tx.cancelled ?? tx.cancel };
  }
  return pasos;
}
