// Parser del chat de creación: texto rioplatense → campos del acuerdo.
// Determinista y testeable (sin RN ni red). El punto donde más adelante se
// enchufa un modelo es responderLibre(); la UI nunca promete esa capacidad.

import { formatARS, parseARStoCents, PLANTILLAS } from "./domain";
import type { Template } from "./api";

export type Paso =
  | "tipo"
  | "titulo"
  | "contraparte"
  | "monto"
  | "plazos"
  | "condiciones"
  | "confirmar";

export interface Draft {
  template?: Template;
  titulo?: string;
  contraparte?: string;
  amountCents?: number;
  acceptDays?: number;
  reviewDays?: number;
  condiciones?: string;
}

export interface ChipSugerido {
  label: string;
  /** Lo que se interpreta al tocarlo; "cmd:*" son comandos internos. */
  enviar: string;
  primario?: boolean;
}

export interface SalidaBot {
  mensajes: string[];
  chips: ChipSugerido[];
  /** La vista llama onIrAForm (escape honesto al formulario). */
  irAForm?: boolean;
}

export interface EstadoConversacion {
  paso: Paso;
  draft: Draft;
  /** Ya se reformuló este paso una vez: la próxima falla deriva al formulario. */
  reintento: boolean;
  /** Campo en edición desde el resumen; al completarse se vuelve a confirmar. */
  editando: Paso | null;
  tituloSugerido?: string;
}

export interface ResultadoInterpretar {
  estado: EstadoConversacion;
  salida: SalidaBot;
  /** true cuando el usuario confirmó en el resumen: la vista crea el acuerdo. */
  confirmado: boolean;
}

const CHIP_FORM: ChipSugerido = {
  label: "Completar en el formulario",
  enviar: "cmd:form",
};

const NOMBRE_CAMPO: Record<Paso, string> = {
  tipo: "el tipo",
  titulo: "el título",
  contraparte: "la contraparte",
  monto: "el monto",
  plazos: "los plazos",
  condiciones: "las condiciones",
  confirmar: "el resumen",
};

const ORDEN: Paso[] = ["tipo", "titulo", "contraparte", "monto", "plazos", "condiciones"];

const KEYS_PASO: Record<Paso, (keyof Draft)[]> = {
  tipo: ["template"],
  titulo: ["titulo"],
  contraparte: ["contraparte"],
  monto: ["amountCents"],
  plazos: ["acceptDays", "reviewDays"],
  condiciones: ["condiciones"],
  confirmar: [],
};

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ── Tipo de acuerdo ──────────────────────────────────────────────────────────

const TIPO_HINTS: [RegExp, Template][] = [
  [/\b(garant[ií]a|alquiler|alquilo|depto|departamento|reserva|seña|auto|moto|camioneta)\b/i, "guarantee"],
  [/\b(entradas?|compra|compro|venta|vendo|tickets?|recital|concierto|show|zapatillas|anticipada)\b/i, "sale"],
];

/** Primer indicio en el texto gana ("garantía ... entrada" → el que aparece antes). */
export function parseTipo(texto: string): Template | null {
  let best: { i: number; tipo: Template } | null = null;
  for (const [re, tipo] of TIPO_HINTS) {
    const m = normalizar(texto).match(re);
    if (m && m.index !== undefined && (!best || m.index < best.i)) {
      best = { i: m.index, tipo };
    }
  }
  return best ? best.tipo : null;
}

// ── Monto (centavos ARS) ─────────────────────────────────────────────────────

const RE_MONTO_MULT = /(\d[\d.,]*)\s*(k|mil|lucas?|palos?|mill[oó]n(?:es)?)\b/i;

/**
 * "$ 1.500.000", "600.000", "600 mil", "$600k", "1,5 millones", "600 lucas" →
 * centavos. Reusa parseARStoCents primero; después variantes con multiplicador.
 * Números sueltos sin $ ni multiplicador dentro de una frase NO cuentan
 * ("2 ambientes" no es plata): en el paso de monto se pide el monto solo.
 */
export function parseMontoAR(texto: string): number | null {
  const directo = parseARStoCents(texto);
  if (directo !== null) return directo;

  const mult = texto.match(RE_MONTO_MULT);
  if (mult) {
    const n = Number(mult[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) {
      const factor = /^(k|mil|lucas?)$/i.test(mult[2]) ? 1_000 : 1_000_000;
      const cents = Math.round(n * factor * 100);
      if (Number.isSafeInteger(cents) && cents > 0) return cents;
    }
  }

  const conSigno = texto.match(/\$\s*(\d[\d.,]*)/);
  if (conSigno) {
    const cents = parseARStoCents(conSigno[1]);
    if (cents !== null) return cents;
  }

  const limpio = texto.replace(/[Aa][Rr]\$|\$|\bars\b|\bpesos\b/gi, " ").trim();
  const deNuevo = parseARStoCents(limpio);
  if (deNuevo !== null) return deNuevo;

  if (/\bun mill[oó]n\b/i.test(texto)) return 100_000_000;
  return null;
}

// ── Plazos (días) ────────────────────────────────────────────────────────────

const NUM_PALABRA: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, veinte: 20, treinta: 30,
};

const RE_DIAS =
  /\b(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta)\s*(d[ií]as?|semanas?|mes(?:es)?)\b/gi;

/** Todas las expresiones con unidad, en días ("3 días"→3, "una semana"→7, "un mes"→30). */
function diasConUnidad(texto: string): number[] {
  const t = normalizar(texto);
  const out: number[] = [];
  const re = new RegExp(RE_DIAS.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM_PALABRA[m[1]];
    if (!Number.isFinite(n)) continue;
    const u = m[2];
    const factor = u.startsWith("semana") ? 7 : u.startsWith("mes") ? 30 : 1;
    out.push(n * factor);
  }
  return out;
}

/** Primer plazo con unidad; si el texto es sólo un número ("3"), ese. */
export function parseDias(texto: string): number | null {
  const u = diasConUnidad(texto);
  if (u.length) return u[0];
  const suelto = normalizar(texto).match(/^\d{1,3}$/);
  return suelto ? Number(suelto[0]) : null;
}

interface Plazos {
  accept: number;
  review?: number;
}

/**
 * "3 días para aceptar y 14 para completar" → {3,14}. Con unidad explícita
 * siempre; sin unidad sólo si soloConUnidad=false (paso dedicado, donde un
 * número suelto sí es un plazo).
 */
function parsePlazos(texto: string, soloConUnidad: boolean): Plazos | null {
  const u = diasConUnidad(texto);
  if (u.length) return { accept: u[0], review: u[1] };
  if (soloConUnidad) return null;
  const nums = normalizar(texto).match(/\b\d{1,3}\b/g)?.map(Number) ?? [];
  if (!nums.length) return null;
  return { accept: nums[0], review: nums[1] };
}

/** Plazo de cierre por defecto: 14 días, o el doble del de aceptación si pasa de 14. */
function reviewDefault(accept: number): number {
  return accept >= 14 ? accept * 2 : 14;
}

// ── Contraparte ──────────────────────────────────────────────────────────────
// Estrategia simple: lo que sigue a "con"/"para"/"a" (en ese orden de
// confianza), cortando en conectores o números. Se descartan artículos,
// posesivos y nombres comunes que no son personas.

const PREPS_NOMBRE = new Set([
  "con", "para", "a", "el", "la", "los", "las", "un", "una", "del", "al",
  "mi", "tu", "su", "mis", "tus", "sus", "vos", "me", "te", "nos",
]);

const STOP_NOMBRE = new Set([
  "por", "de", "del", "en", "a", "con", "que", "y", "el", "la", "los", "las",
  "un", "una", "al", "lo", "mi", "tu", "su", "para", "dias", "dia", "semana",
  "semanas", "mes", "meses", "pesos", "mil", "k", "plazo", "contra", "hasta",
]);

// Cosas que suelen seguir a "con/para" y no son personas.
const NOMBRE_NO = new Set([
  "detalle", "todo", "toda", "tiempo", "anticipacion", "anticipado", "garantia",
  "entrada", "entradas", "auto", "depto", "departamento", "alquiler", "venta",
  "compra", "recital", "concierto", "show", "partido", "evento", "balcon",
  "cochera", "garage", "vista", "patio", "terraza", "ambiente", "ambientes",
  "plata", "guita", "cuota", "cuotas", "seña", "reserva", "fin", "semana",
  "mes", "adelanto", "anticipo", "mila",
]);

interface NombreHit {
  nombre: string;
  prepDesde: number;
  hasta: number;
}

function nombreDesdeCola(cola: string, offsetBase: number, prepDesde: number): NombreHit | null {
  const reW = /\S+/g;
  let wm: RegExpExecArray | null;
  const kept: { w: string; s: number; e: number }[] = [];
  let started = false;
  while ((wm = reW.exec(cola))) {
    const w = wm[0];
    const nw = normalizar(w).replace(/[^a-z0-9ñ]/g, "");
    if (!started) {
      if (PREPS_NOMBRE.has(nw)) continue;
      if (/^\d/.test(w)) return null;
      started = true;
    }
    if (/^\d/.test(w) || STOP_NOMBRE.has(nw)) break;
    kept.push({ w, s: offsetBase + wm.index, e: offsetBase + wm.index + w.length });
    if (kept.length >= 4) break;
  }
  const limpias = kept
    .map((k) => ({ ...k, w: k.w.replace(/^[¿?¡!.,;:]+|[¿?¡!.,;:]+$/g, "") }))
    .filter((k) => /[a-záéíóúñ]/i.test(k.w));
  if (!limpias.length) return null;
  if (limpias.length === 1 && NOMBRE_NO.has(normalizar(limpias[0].w))) return null;
  const nombre = limpias.map((k) => cap(k.w)).join(" ");
  if (nombre.length > 40) return null;
  return { nombre, prepDesde, hasta: limpias[limpias.length - 1].e };
}

function extraerNombre(texto: string): NombreHit | null {
  // Sólo posiciones de preposición (sin capturar la cola): una cola puede
  // contener otra preposición más confiable ("garantía del corsa CON Bruno").
  const grupos: Record<string, { idx: number; len: number }[]> = { con: [], para: [], a: [] };
  const re = /\b(con|para|a)\s+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    // \b de JS no ve acentos: la "a" final de "garantía" haría boundary falso.
    const prev = texto[m.index - 1];
    if (prev && /[a-záéíóúüñ]/i.test(prev)) continue;
    const key = normalizar(m[1]);
    if (key in grupos) grupos[key].push({ idx: m.index, len: m[0].length });
  }
  for (const prep of ["con", "para", "a"]) {
    for (const g of grupos[prep]) {
      const hit = nombreDesdeCola(texto.slice(g.idx + g.len), g.idx + g.len, g.idx);
      if (hit) return hit;
    }
  }
  return null;
}

export function parseContraparte(texto: string): string | null {
  return extraerNombre(texto)?.nombre ?? null;
}

// ── Extracción combinada y título sugerido ───────────────────────────────────

/**
 * Lo que se puede sacar del texto libre. soloFaltantes=true (pasos guiados)
 * nunca pisa lo ya cargado; en el resumen (false) sí corrige campos existentes.
 * Título no se adivina: se pide tal cual lo escribe el usuario.
 */
export function extraerCampos(texto: string, draft: Draft, soloFaltantes = true): Partial<Draft> {
  const out: Partial<Draft> = {};
  if ((!soloFaltantes || !draft.template)) {
    const t = parseTipo(texto);
    if (t) out.template = t;
  }
  if ((!soloFaltantes || draft.amountCents === undefined)) {
    const m = parseMontoAR(texto);
    if (m !== null) out.amountCents = m;
  }
  if ((!soloFaltantes || !draft.contraparte)) {
    const c = parseContraparte(texto);
    if (c) out.contraparte = c;
  }
  if ((!soloFaltantes || draft.acceptDays === undefined)) {
    // En corrección libre (resumen) dos números sueltos también son plazos ("5 y 10").
    let p = parsePlazos(texto, true);
    if (!p && !soloFaltantes) {
      const nums = normalizar(texto).match(/\b\d{1,3}\b/g)?.map(Number) ?? [];
      if (nums.length >= 2) p = { accept: nums[0], review: nums[1] };
    }
    if (p) {
      out.acceptDays = p.accept;
      out.reviewDays = p.review ?? reviewDefault(p.accept);
    }
  }
  return out;
}

/** Título de oferta: el texto sin monto ni "con <contraparte>", capitalizado. */
export function sugerirTitulo(texto: string): string | null {
  let t = texto;
  const nom = extraerNombre(texto);
  if (nom) t = `${t.slice(0, nom.prepDesde)} ${t.slice(nom.hasta)}`;
  t = t.replace(
    /(?:\$\s*)?\d[\d.,]*\s*(?:k|mil|lucas?|palos?|mill[oó]n(?:es)?|pesos)?/gi,
    " ",
  );
  t = t.replace(/\s{2,}/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    t = t.replace(
      /^(quiero|necesito|armar|hacer|crear|ponele|seria|un|una|el|la|es|para|de|por|con|mi)\s+/i,
      "",
    );
  }
  t = t
    .replace(/(\s+(por|para|de|del|con|en|y|a|el|la|los|las|un|una))+\s*$/i, "")
    .replace(/^[.,;:¡!¿?\-–—\s]+|[.,;:¡!¿?\-–—\s]+$/g, "")
    .trim();
  if (t.length < 3 || !/[a-záéíóúñ]/i.test(t)) return null;
  return cap(t.slice(0, 70));
}

// ── Punto de extensión LLM ───────────────────────────────────────────────────

/**
 * Interpretación del texto libre fuera de guion. Hoy es determinista
 * (keywords + regex via extraerCampos). Para enchufar un modelo más adelante:
 * reemplazar el cuerpo por la llamada con la API key y devolver los mismos
 * campos de Draft; quien llama no cambia. La UI no promete esa capacidad.
 */
export function responderLibre(texto: string, estado: EstadoConversacion): Partial<Draft> {
  return extraerCampos(texto, estado.draft, estado.paso !== "confirmar");
}

// ── Textos del asistente ─────────────────────────────────────────────────────

function chipsTipo(): ChipSugerido[] {
  return [
    { label: "Garantía de auto", enviar: "garantía de auto" },
    { label: "Compra de entrada", enviar: "compra de entrada" },
  ];
}

function chipsDePaso(paso: Paso, estado: EstadoConversacion): ChipSugerido[] {
  switch (paso) {
    case "tipo":
      return chipsTipo();
    case "titulo":
      return estado.tituloSugerido
        ? [{ label: estado.tituloSugerido, enviar: estado.tituloSugerido }]
        : [];
    case "plazos":
      return [
        { label: "3 días", enviar: "3 días" },
        { label: "7 días", enviar: "7 días" },
        { label: "14 días", enviar: "14 días" },
      ];
    case "condiciones":
      return [{ label: "Saltear (uso condición estándar)", enviar: "saltear" }];
    default:
      return [];
  }
}

function chipsConfirmar(): ChipSugerido[] {
  const campos: [Paso, string][] = [
    ["tipo", "tipo"],
    ["titulo", "título"],
    ["contraparte", "contraparte"],
    ["monto", "monto"],
    ["plazos", "plazos"],
    ["condiciones", "condiciones"],
  ];
  return [
    { label: "Crear", enviar: "crear", primario: true },
    ...campos.map(([p, label]) => ({ label: `Cambiar ${label}`, enviar: `cambiar ${p}` })),
    CHIP_FORM,
  ];
}

function condicionDefault(t?: Template): string {
  const base = (t ? PLANTILLAS[t] : PLANTILLAS.guarantee).condicionesEj;
  const sinEj = base.replace(/^ej\.?:\s*/i, "");
  return cap(sinEj);
}

function preguntar(paso: Paso, draft: Draft, estado: EstadoConversacion): SalidaBot {
  const chips = chipsDePaso(paso, estado);
  switch (paso) {
    case "tipo":
      return {
        mensajes: ["¿Garantía o venta? Podés contarme todo de una, ej.: «garantía del corsa con Bruno por 600 mil»."],
        chips,
      };
    case "titulo": {
      const ej =
        draft.template === "sale"
          ? "«Entrada para el recital del sábado»"
          : "«Garantía por el Corsa del fin de semana»";
      return { mensajes: [`¿Cómo lo titulamos? Una frase corta, ej.: ${ej}.`], chips };
    }
    case "contraparte": {
      const q =
        draft.template === "sale"
          ? "¿Quién es el comprador? Es quien deposita el pago."
          : "¿Quién es el cliente? Es quien deposita la garantía.";
      return { mensajes: [q], chips };
    }
    case "monto":
      return { mensajes: ["¿De cuánto es? En pesos: «600.000» o «600 mil»."], chips };
    case "plazos":
      return {
        mensajes: [
          "¿En cuántos días tiene que aceptar la otra parte? Para completar el trato dejo 14 días por defecto; si querés los dos, escribí «5 y 21».",
        ],
        chips,
      };
    case "condiciones":
      return {
        mensajes: [
          `Último paso: las condiciones que acepta la otra parte, con tus palabras — quedan tal cual. Si las salteás uso: «${condicionDefault(draft.template)}»`,
        ],
        chips,
      };
    case "confirmar":
      return { mensajes: [resumen(draft), "¿Lo creo? Tocá un campo para cambiarlo."], chips: chipsConfirmar() };
  }
}

const REFORMULA: Record<Paso, string> = {
  tipo: "No me quedó claro: ¿garantía (la plata se devuelve si no hay reclamos) o venta (se libera el pago al concretar)?",
  titulo: "Un título corto alcanza, ej.: «Garantía por el Corsa del fin de semana».",
  contraparte: "Un nombre corto alcanza, ej.: «Bruno».",
  monto: "Ese monto no me cierra. Probá así: «600.000» o «600 mil».",
  plazos: "No capté los plazos. Probá «3 y 14» o algo como «una semana».",
  condiciones: "Escribí la regla principal, ej.: «se devuelve entera si el auto vuelve sin daños». O tocá Saltear.",
  confirmar: "",
};

function recortar(t: string, max: number): string {
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export function resumen(d: Draft): string {
  const p = d.template ? PLANTILLAS[d.template] : undefined;
  const rolDeposita = p ? p.rol.depositor.toLowerCase() : "la otra parte";
  return [
    "Queda así:",
    `· Tipo: ${p?.nombre ?? "—"}`,
    `· Título: ${d.titulo ?? "—"}`,
    `· Contraparte: ${d.contraparte ?? "—"} (${rolDeposita})`,
    `· Monto: ${d.amountCents !== undefined ? formatARS(d.amountCents) : "—"}`,
    `· Plazos: acepta en ${d.acceptDays ?? "—"} días · completa en ${d.reviewDays ?? "—"} días`,
    `· Condiciones: ${recortar(d.condiciones ?? "—", 140)}`,
    "El servicio cobra 1% sobre lo liberado a quien cobra.",
  ].join("\n");
}

// ── Motor de la conversación ─────────────────────────────────────────────────

export function inicioConversacion(): { estado: EstadoConversacion; salida: SalidaBot } {
  const estado: EstadoConversacion = { paso: "tipo", draft: {}, reintento: false, editando: null };
  return {
    estado,
    salida: {
      mensajes: [
        "Dale, lo armamos por chat. Entiendo frases comunes — montos, días, nombres — y si me trabo te paso al formulario.",
        "¿Qué necesitás: garantía o venta? Podés contarme todo de una, ej.: «garantía del corsa con Bruno por 600 mil».",
      ],
      chips: chipsTipo(),
    },
  };
}

function siguientePaso(d: Draft): Paso {
  const falta: Record<Paso, boolean> = {
    tipo: !d.template,
    titulo: !d.titulo,
    contraparte: !d.contraparte,
    monto: d.amountCents === undefined,
    plazos: d.acceptDays === undefined,
    condiciones: !d.condiciones,
    confirmar: false,
  };
  return ORDEN.find((p) => falta[p]) ?? "confirmar";
}

interface PasoResult {
  ok: boolean;
  patch?: Partial<Draft>;
  /** Razón concreta (dato fuera de rango): no quema el reintento. */
  motivo?: string;
}

function procesarPaso(paso: Paso, texto: string, draft: Draft): PasoResult {
  const t = texto.trim();
  const norm = normalizar(t);
  switch (paso) {
    case "tipo": {
      const tipo = parseTipo(t);
      return tipo ? { ok: true, patch: { template: tipo } } : { ok: false };
    }
    case "titulo":
      if (t.length < 3) return { ok: false, motivo: "Muy corto: un título de al menos 3 letras." };
      return { ok: true, patch: { titulo: cap(t.slice(0, 70)) } };
    case "contraparte": {
      const hit = nombreDesdeCola(t, 0, 0);
      if (!hit) return { ok: false };
      return { ok: true, patch: { contraparte: hit.nombre } };
    }
    case "monto": {
      const m = parseMontoAR(t);
      return m !== null ? { ok: true, patch: { amountCents: m } } : { ok: false };
    }
    case "plazos": {
      const p = parsePlazos(t, false);
      if (!p) return { ok: false };
      if (p.accept < 1 || p.accept > 60)
        return { ok: false, motivo: "El plazo para aceptar va de 1 a 60 días." };
      const review = p.review ?? reviewDefault(p.accept);
      if (review <= p.accept)
        return { ok: false, motivo: "El plazo para completar tiene que ser mayor que el de aceptar." };
      if (review > 365)
        return { ok: false, motivo: "El plazo para completar no pasa de 365 días." };
      return { ok: true, patch: { acceptDays: p.accept, reviewDays: review } };
    }
    case "condiciones": {
      if (/^salt/.test(norm) || ["por defecto", "default", "estandar", "después", "despues"].includes(norm))
        return { ok: true, patch: { condiciones: condicionDefault(draft.template) } };
      if (t.length < 10) return { ok: false, motivo: "Una frase alcanza — mínimo 10 letras." };
      return { ok: true, patch: { condiciones: t.slice(0, 2000) } };
    }
    default:
      return { ok: false };
  }
}

function describirPatch(p: Partial<Draft>, d: Draft): string[] {
  const out: string[] = [];
  if (p.template) out.push(PLANTILLAS[p.template].nombre.toLowerCase());
  if (p.titulo) out.push(`título «${p.titulo}»`);
  if (p.contraparte) out.push(`con ${p.contraparte}`);
  if (p.amountCents !== undefined) out.push(formatARS(p.amountCents));
  if (p.acceptDays !== undefined) out.push(`plazos ${p.acceptDays}/${p.reviewDays ?? d.reviewDays ?? "?"} días`);
  if (p.condiciones) out.push("condiciones");
  return out;
}

function ackPaso(paso: Paso, d: Draft): string {
  switch (paso) {
    case "tipo":
      return `${PLANTILLAS[d.template ?? "guarantee"].nombre}, dale.`;
    case "contraparte":
      return `Anotado: ${d.contraparte}.`;
    case "monto":
      return `Perfecto: ${formatARS(d.amountCents ?? 0)}.`;
    case "plazos":
      return `Acepta en ${d.acceptDays} días; completa en ${d.reviewDays}.`;
    case "condiciones":
      return "Anotado.";
    default:
      return "Dale.";
  }
}

const CONFIRMAR = new Set([
  "crear", "crealo", "creala", "confirmar", "confirmado", "dale", "ok", "okay",
  "si", "listo", "va", "mandale", "perfecto", "de una", "bueno", "joya",
]);

function esConfirmar(norm: string): boolean {
  return CONFIRMAR.has(norm) || /^(crear|confirmar)\b/.test(norm);
}

const MAPA_CAMPO: [RegExp, Paso][] = [
  [/\b(tipo|plantilla|categoria|garantia|venta|entrada|alquiler)\b/, "tipo"],
  [/\b(titulo|encabezado)\b/, "titulo"],
  [/\b(contraparte|cliente|comprador|parte|persona|quien)\b/, "contraparte"],
  [/\b(monto|plata|precio|pesos|importe|guita)\b/, "monto"],
  [/\b(plazos?|dias|fechas?|tiempo|vencimiento|aceptar|completar)\b/, "plazos"],
  [/\b(condicion|condiciones|terminos|reglas?|clausulas?)\b/, "condiciones"],
];

function campoDeTexto(norm: string): Paso | null {
  const t = norm.replace(/^(cambiar?|cambio|editar?|modificar?|corregir?|quiero cambiar|el|la|los|las)\s+/, "");
  for (const [re, p] of MAPA_CAMPO) if (re.test(t) || re.test(norm)) return p;
  return null;
}

export function interpretar(textoRaw: string, prev: EstadoConversacion): ResultadoInterpretar {
  const estado: EstadoConversacion = { ...prev, draft: { ...prev.draft } };
  const salida: SalidaBot = { mensajes: [], chips: [] };
  const texto = textoRaw.trim();
  if (!texto) return { estado, salida, confirmado: false };
  const norm = normalizar(texto);

  if (texto === "cmd:form" || /\bformulario\b/.test(norm)) {
    salida.irAForm = true;
    return { estado, salida, confirmado: false };
  }

  if (estado.paso === "confirmar") return interpretarConfirmar(texto, norm, estado);

  const paso = estado.paso;
  const r = procesarPaso(paso, texto, estado.draft);
  const libre = responderLibre(texto, estado);
  const keysPaso = KEYS_PASO[paso];

  const aplicado: Partial<Draft> = r.ok && r.patch ? { ...r.patch } : {};
  let ok = r.ok;
  if (!ok && keysPaso.length && keysPaso.every((k) => libre[k] !== undefined)) {
    ok = true;
    for (const k of keysPaso) (aplicado as Record<string, unknown>)[k] = libre[k];
  }
  // Lo que vino de regalo (otros campos faltantes en el mismo mensaje).
  const otros: Partial<Draft> = {};
  for (const k of Object.keys(libre) as (keyof Draft)[]) {
    if (libre[k] === undefined || (keysPaso as (keyof Draft)[]).includes(k)) continue;
    otros[k] = libre[k] as never;
  }

  const draft2 = { ...estado.draft, ...aplicado, ...otros };
  if (!draft2.titulo) {
    const sug = sugerirTitulo(texto);
    // Sugerir el nombre de la plantilla como título no aporta.
    const esNombrePlantilla =
      sug && draft2.template && normalizar(sug) === normalizar(PLANTILLAS[draft2.template].nombre);
    if (sug && !esNombrePlantilla) estado.tituloSugerido = sug;
  }

  if (ok) {
    estado.draft = draft2;
    estado.reintento = false;
    if (estado.editando) {
      const campo = estado.editando;
      estado.editando = null;
      estado.paso = "confirmar";
      salida.mensajes = [`Dale, ${NOMBRE_CAMPO[campo]} quedó así.`, resumen(draft2), "¿Lo creo?"];
      salida.chips = chipsConfirmar();
    } else {
      estado.paso = siguientePaso(draft2);
      const q = preguntar(estado.paso, draft2, estado);
      const frags = describirPatch({ ...aplicado, ...otros }, draft2);
      const ack = frags.length > 1 ? `Dale: ${frags.join(" · ")}.` : ackPaso(paso, draft2);
      salida.mensajes = [ack, ...q.mensajes];
      salida.chips = q.chips;
    }
    return { estado, salida, confirmado: false };
  }

  // Fallo: se guarda lo rescatable y se reformula una vez antes de ofrecer el form.
  estado.draft = draft2;
  const otrosFrags = describirPatch(otros, draft2);
  const nota = otrosFrags.length ? `Igual anoté: ${otrosFrags.join(" · ")}. ` : "";
  if (r.motivo) {
    salida.mensajes = [nota + r.motivo];
    salida.chips = estado.reintento ? [...chipsDePaso(paso, estado), CHIP_FORM] : chipsDePaso(paso, estado);
  } else if (!estado.reintento) {
    estado.reintento = true;
    salida.mensajes = [nota + REFORMULA[paso]];
    salida.chips = [...chipsDePaso(paso, estado), CHIP_FORM];
  } else {
    salida.mensajes = [`${nota}Acá me trabo: el formulario te deja cargarlo directo.`];
    salida.chips = [CHIP_FORM];
  }
  return { estado, salida, confirmado: false };
}

function interpretarConfirmar(
  texto: string,
  norm: string,
  estado: EstadoConversacion,
): ResultadoInterpretar {
  const salida: SalidaBot = { mensajes: [], chips: [] };

  if (esConfirmar(norm)) {
    salida.mensajes = ["Dale, lo creo."];
    return { estado, salida, confirmado: true };
  }

  // Primero valores inline ("el monto queda en 60 mil" actualiza directo);
  // sólo si no hay valor se interpreta como pedido de editar un campo.
  const libre = responderLibre(texto, estado);
  const cambios: Partial<Draft> = {};
  for (const k of Object.keys(libre) as (keyof Draft)[]) {
    if (libre[k] !== undefined && estado.draft[k] !== libre[k]) cambios[k] = libre[k] as never;
  }
  if (Object.keys(cambios).length) {
    estado.draft = { ...estado.draft, ...cambios };
    const frags = describirPatch(cambios, estado.draft);
    salida.mensajes = [`Anotado: ${frags.join(" · ")}.`, resumen(estado.draft), "¿Lo creo?"];
    salida.chips = chipsConfirmar();
    return { estado, salida, confirmado: false };
  }

  const campo = campoDeTexto(norm);
  if (campo) {
    estado.editando = campo;
    estado.paso = campo;
    estado.reintento = false;
    const q = preguntar(campo, estado.draft, estado);
    salida.mensajes = [`Dale, cambiemos ${NOMBRE_CAMPO[campo]}.`, ...q.mensajes];
    salida.chips = q.chips;
    return { estado, salida, confirmado: false };
  }

  salida.mensajes = ["¿Qué cambio? Tocá el campo abajo o escribí «crear» para terminar."];
  salida.chips = chipsConfirmar();
  return { estado, salida, confirmado: false };
}
