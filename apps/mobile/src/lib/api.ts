import { PRESENTATION, presentationRequest } from "./presentation";
// Cliente fetch tolerante para la capa demo de ContractAR (apps/web/src/app/api).
// Todos los montos son enteros en centavos ARS; la UI jamás nombra token ni red.
//
// El contrato se está reconciliando en el servidor: este cliente envía las dos
// formas (userId + creatorUserId, parties anidado + counterpartyLabel plano) y
// normaliza las respuestas con defaults defensivos. Cuando el server quede
// canónico, los campos extra se ignoran solos.

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.23.84:3000";

// Mapa copiado de shared/errors.ts (la app es standalone: no importa shared/).
const ERROR_MESSAGES: Record<string, string> = {
  NotAuthorized: "Esta acción no corresponde a tu rol en el acuerdo.",
  InvalidState: "El acuerdo ya cambió de estado; recargá para ver el paso actual.",
  NotDepositor: "Sólo quien deposita puede hacer esto.",
  NotBeneficiary: "Sólo quien cobra puede hacer esto.",
  NotArbiter: "Sólo el árbitro designado puede resolver la disputa.",
  AlreadySettled: "El acuerdo ya está cerrado.",
  WrongAmount: "El monto no coincide con lo pactado.",
  SplitMismatch: "La suma de lo que recibe cada parte debe ser igual al depósito.",
  DeadlinePassed: "El plazo venció.",
  DeadlineNotPassed: "El plazo todavía no venció.",
  InsufficientBalance: "Saldo insuficiente para esta operación.",
  InsufficientAllowance: "Falta autorizar el monto al contrato.",
  PaymentPending: "El pago todavía está pendiente.",
  PaymentRejected: "El pago fue rechazado.",
  DuplicateOperation: "Esta operación ya fue registrada.",
  WithdrawLocked: "No podés retirar saldo que está protegido en un acuerdo.",
};

export function humanize(code: string): string {
  for (const [key, text] of Object.entries(ERROR_MESSAGES)) {
    if (code.includes(key)) return text;
  }
  if (code === "network") return "Sin conexión con el servidor de la demo.";
  return "Algo salió mal. Reintentá; si sigue, revisá el comprobante técnico.";
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly human: string;
  constructor(code: string, status: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
    this.human =
      message && !Object.keys(ERROR_MESSAGES).some((k) => code.includes(k))
        ? message
        : humanize(code);
  }
}

function errorCodeFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.error === "string") return b.error;
  if (b.error && typeof b.error === "object") {
    const e = b.error as Record<string, unknown>;
    if (typeof e.code === "string") return e.code;
    if (typeof e.message === "string") return e.message;
  }
  return null;
}

// Sin timeout propio, fetch queda colgado si el server no responde y la
// pantalla se queda "cargando" para siempre. 12 s -> error con reintento.
const TIMEOUT_MS = 12000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (PRESENTATION) return await presentationRequest(path, init) as T;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch (e) {
    // Log del error de red real: diagnóstico en Metro (Network request
    // failed, timeout, DNS, ATS, etc).
    console.warn(`[api] ${init?.method ?? "GET"} ${path} -> ${API_URL} falló:`, e);
    const timeout =
      e instanceof Error && (e.name === "AbortError" || /abort/i.test(e.message));
    throw new ApiError(
      "network",
      0,
      timeout
        ? "El servidor no respondió a tiempo. Revisá que el teléfono esté en la misma Wi-Fi y reintentá."
        : "Sin conexión con el servidor de la demo. Revisá la red y reintentá.",
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const code = errorCodeFrom(body) ?? `HTTP_${res.status}`;
    const msg =
      body && typeof body === "object"
        ? (body as { error?: { message?: string } }).error?.message
        : undefined;
    throw new ApiError(code, res.status, msg);
  }
  return body as T;
}

// ── Normalización defensiva ──────────────────────────────────────────────────

const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;
const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
    return Number(v);
  return undefined;
};

// Estados del contrato Nano (Fuji). El server es la fuente: llegan como
// string y se consumen tal cual; el orden numérico es sólo fallback para
// respuestas viejas que mandaban el índice del enum.
export type State =
  | "None"
  | "Created"
  | "Accepted"
  | "Funded"
  | "Delivered"
  | "OutcomeProposed"
  | "Disputed"
  | "Settled"
  | "Cancelled"
  | "Resolved"
  | "Completed";

const STATE_NAMES: State[] = [
  "None",
  "Created",
  "Accepted",
  "Funded",
  "Delivered",
  "OutcomeProposed",
  "Disputed",
  "Settled",
  "Cancelled",
  "Resolved",
  "Completed",
];

function stateOf(v: unknown): State {
  const s = str(v)?.toLowerCase().replace(/[_-]/g, "");
  const hit = STATE_NAMES.find((x) => x.toLowerCase() === s);
  if (hit) return hit;
  const n = num(v);
  if (n !== undefined && n >= 0 && n < STATE_NAMES.length) return STATE_NAMES[n];
  return "None";
}

export type Template = "guarantee" | "sale";

function templateOf(v: unknown): Template {
  const n = num(v);
  if (n === 1) return "sale";
  const s = str(v)?.toLowerCase();
  if (s === "sale" || s === "1") return "sale";
  return "guarantee";
}

export type Role = "creator" | "depositor" | "beneficiary" | "arbiter";

export type Action =
  | "accept"
  | "cancel"
  | "fund"
  | "proposeOutcome"
  | "acceptOutcome"
  | "dispute"
  | "rule"
  | "refundAfterTimeout";

export interface RoleInfo {
  userId?: string;
  address?: string;
}

/** Disponibilidad de acción tal como la reporta el server (autoritativa). */
export interface AccionServer {
  action: Action;
  enabled: boolean;
  reason?: string;
}

/** Evento de cronología del server. */
export interface EventoTimeline {
  label: string;
  at?: number;
  txHash?: string;
}

export interface AgreementDetail {
  id: string;
  template: Template;
  state: State;
  title: string;
  terms: string;
  amountCents: number;
  /** Saldo aún protegido. Antes de fondear equivale al monto pactado. */
  remainingCents: number;
  parties: { creatorLabel: string; counterpartyLabel: string };
  yourRole: Role | null;
  roles: Record<Role, RoleInfo>;
  deadlines: { acceptAt?: number; reviewAt?: number };
  termsHash?: string;
  proposerUserId?: string;
  proposedToBeneficiaryCents?: number;
  /** Reparto final cuando el acuerdo cerró (server: settlement). */
  settlement?: { toBeneficiary: number; toDepositor: number; fee: number };
  /** Acciones según el server; undefined si el endpoint no las devuelve. */
  actions?: AccionServer[];
  /** Cronología según el server; undefined si no la devuelve. */
  timeline?: EventoTimeline[];
  onchain: {
    pending: boolean;
    chainId?: number;
    escrow?: string;
    contractAgreementId?: number;
    txHashes: Record<string, string>;
  };
  createdAt?: number;
  updatedAt?: number;
}

export interface AgreementSummary {
  id: string;
  title: string;
  template: Template;
  state: State;
  amountCents: number;
  yourRole: Role | null;
  counterpartyLabel?: string;
  createdAt?: number;
}

function ms(v: unknown): number | undefined {
  const n = num(v);
  if (n !== undefined) return n < 1e12 ? n * 1000 : n;
  const s = str(v);
  if (s) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
  }
  return undefined;
}

function roleInfo(v: unknown): RoleInfo {
  const r = rec(v);
  return { userId: str(r.userId) ?? str(v), address: str(r.address) };
}

const ROLE_NAMES: Role[] = ["creator", "depositor", "beneficiary", "arbiter"];

function roleOf(v: unknown): Role | null {
  const s = str(v);
  return s && (ROLE_NAMES as string[]).includes(s) ? (s as Role) : null;
}

const ACTION_NAMES: Action[] = [
  "accept",
  "cancel",
  "fund",
  "proposeOutcome",
  "acceptOutcome",
  "dispute",
  "rule",
  "refundAfterTimeout",
];

function accionesServer(v: unknown): AccionServer[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: AccionServer[] = [];
  for (const item of v) {
    const r = rec(item);
    const action = str(r.action) as Action | undefined;
    if (!action || !(ACTION_NAMES as string[]).includes(action)) continue;
    out.push({
      action,
      enabled: r.enabled === true,
      reason: str(r.reason),
    });
  }
  return out.length > 0 ? out : undefined;
}

function timelineServer(v: unknown): EventoTimeline[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: EventoTimeline[] = [];
  for (const item of v) {
    const r = rec(item);
    const label = str(r.label);
    if (!label) continue;
    out.push({ label, at: ms(r.at), txHash: str(r.txHash) });
  }
  return out.length > 0 ? out : undefined;
}

/** Rol del usuario: misma precedencia que roleOf() del servidor. */
export function roleFor(roles: Record<Role, RoleInfo>, userId: string): Role | null {
  if (roles.depositor.userId === userId) return "depositor";
  if (roles.beneficiary.userId === userId) return "beneficiary";
  if (roles.arbiter.userId === userId) return "arbiter";
  if (roles.creator.userId === userId) return "creator";
  return null;
}

// El detalle real del server hoy: {agreementId, template, state, termsHash,
// terms{title,terms,parties,amountARS,acceptDeadline,reviewDeadline,...},
// roles{rol:{userId,address}}, amountARS, remainingARS,
// outcomeProposerUserId, proposedToBeneficiaryARS, onchain{...}, timestamps}.
export function normalizeDetail(raw: unknown, fallbackId: string, userId: string): AgreementDetail {
  const root = rec(raw);
  const t = rec(root.terms ?? root.metadata);
  const parties = rec(t.parties ?? root.parties);
  const rolesRaw = rec(root.roles);
  const roles: Record<Role, RoleInfo> = {
    creator: roleInfo(rolesRaw.creator),
    depositor: roleInfo(rolesRaw.depositor),
    beneficiary: roleInfo(rolesRaw.beneficiary),
    arbiter: roleInfo(rolesRaw.arbiter),
  };
  const state = stateOf(root.state);
  const amountCents = num(root.amountARS) ?? num(root.amountCents) ?? num(t.amountARS) ?? 0;
  // Sin fondear, el server reporta remaining onchain en 0: antes de Funded el
  // protegido nominal es el monto pactado.
  const rawRemaining = num(root.remainingARS) ?? num(root.remainingCents);
  const locked =
    state === "Funded" || state === "OutcomeProposed" || state === "Disputed"
      ? rawRemaining ?? amountCents
      : amountCents;
  const on = rec(root.onchain);
  const net = rec(root.network);
  const dl = rec(root.deadlines);
  return {
    id: str(root.agreementId) ?? str(root.id) ?? fallbackId,
    template: templateOf(root.template ?? t.template),
    state,
    title: str(t.title) ?? str(root.title) ?? "Acuerdo",
    terms: str(t.terms) ?? str(root.terms) ?? "",
    amountCents,
    remainingCents: locked,
    parties: {
      creatorLabel: str(parties.creatorLabel) ?? "Quien propone",
      counterpartyLabel: str(parties.counterpartyLabel) ?? "La otra parte",
    },
    yourRole: roleOf(root.yourRole) ?? roleFor(roles, userId),
    roles,
    deadlines: {
      acceptAt: ms(dl.acceptAt ?? t.acceptDeadline ?? root.acceptDeadline),
      reviewAt: ms(dl.reviewAt ?? t.reviewDeadline ?? root.reviewDeadline),
    },
    termsHash: str(root.termsHash),
    proposerUserId:
      str(root.outcomeProposerUserId) ??
      str(rec(root.proposal).proposerUserId) ??
      str(rec(root.proposal).byUserId),
    proposedToBeneficiaryCents:
      num(root.proposedToBeneficiaryARS) ??
      num(root.proposedToBeneficiaryCents) ??
      num(rec(root.proposal).toBeneficiaryARS) ??
      num(rec(root.proposal).toBeneficiary),
    settlement: (() => {
      const s = rec(root.settlement);
      const toB = num(s.toBeneficiaryARS) ?? num(s.toBeneficiary);
      return toB !== undefined
        ? { toBeneficiary: toB, toDepositor: num(s.toDepositorARS) ?? num(s.toDepositor) ?? 0, fee: num(s.feeARS) ?? num(s.fee) ?? 0 }
        : undefined;
    })(),
    actions: accionesServer(root.actions),
    timeline: timelineServer(root.timeline),
    onchain: {
      pending: on.pending === true,
      chainId: num(on.chainId) ?? num(net.chainId),
      escrow: str(on.escrowAddress) ?? str(on.escrow) ?? str(net.escrow),
      contractAgreementId: num(on.contractAgreementId),
      txHashes: (on.txHashes ?? {}) as Record<string, string>,
    },
    createdAt: ms(root.createdAt),
    updatedAt: ms(root.updatedAt),
  };
}

// ── Agreements ───────────────────────────────────────────────────────────────

export interface CreateInput {
  userId: string;
  template: Template;
  title: string;
  terms: string;
  creatorLabel: string;
  counterpartyLabel: string;
  amountCents: number;
  /** Segundos RELATIVOS desde ahora (forma canónica). */
  acceptDeadlineSec: number;
  reviewDeadlineSec: number;
}

export interface CreateResult {
  id: string;
  termsHash?: string;
  state?: string;
}

export function counterpartyUserId(counterpartyLabel: string): string {
  const slug = counterpartyLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return `cp-${slug || "contraparte"}`;
}

/**
 * Crea el acuerdo. Rol del usuario de la app: creator + beneficiary (quien
 * propone y cobra); la contraparte deposita desde el enlace web.
 * `depositorUserId` se intenta omitir primero (canónico: queda pendiente de la
 * aceptación) y sólo se envía si el server de hoy lo exige.
 */
export async function createAgreement(input: CreateInput): Promise<CreateResult> {
  const base = {
    userId: input.userId,
    creatorUserId: input.userId,
    beneficiaryUserId: input.userId,
    template: input.template,
    title: input.title,
    terms: input.terms,
    counterpartyLabel: input.counterpartyLabel,
    parties: {
      creatorLabel: input.creatorLabel,
      counterpartyLabel: input.counterpartyLabel,
    },
    amountARS: input.amountCents,
    acceptDeadlineSec: input.acceptDeadlineSec,
    reviewDeadlineSec: input.reviewDeadlineSec,
  };
  let raw: Record<string, unknown>;
  try {
    raw = await request<Record<string, unknown>>("/api/agreements", {
      method: "POST",
      body: JSON.stringify({ ...base, arbiterUserId: "arbiter-demo" }),
    });
  } catch (e) {
    const needsDepositor =
      e instanceof ApiError &&
      e.status === 400 &&
      /depositorUserId/i.test(e.message);
    if (!needsDepositor) throw e;
    raw = await request<Record<string, unknown>>("/api/agreements", {
      method: "POST",
      body: JSON.stringify({
        ...base,
        arbiterUserId: "arbiter-demo",
        depositorUserId: counterpartyUserId(input.counterpartyLabel),
      }),
    });
  }
  return {
    id: str(raw.agreementId) ?? str(raw.id) ?? "",
    termsHash: str(raw.termsHash),
    state: str(raw.state),
  };
}

/** Lista del server (hoy puede no existir): devuelve null si no está. */
export async function listAgreements(userId: string): Promise<AgreementSummary[] | null> {
  let raw: unknown;
  try {
    raw = await request<unknown>(`/api/agreements?userId=${encodeURIComponent(userId)}`);
  } catch {
    return null;
  }
  const items = Array.isArray(raw) ? raw : rec(raw).agreements;
  if (!Array.isArray(items)) return null;
  return items
    .map((item): AgreementSummary | null => {
      const r = rec(item);
      const meta = rec(r.metadata ?? r.terms);
      const id = str(r.id) ?? str(r.agreementId);
      if (!id) return null;
      const roles = rec(r.roles);
      return {
        id,
        title: str(r.title) ?? str(meta.title) ?? "Acuerdo",
        template: templateOf(r.template ?? meta.template),
        state: stateOf(r.state),
        amountCents: num(r.amountARS) ?? num(r.amountCents) ?? num(meta.amountARS) ?? 0,
        yourRole:
          roleOf(r.yourRole) ??
          roleFor(
            {
              creator: roleInfo(roles.creator),
              depositor: roleInfo(roles.depositor),
              beneficiary: roleInfo(roles.beneficiary),
              arbiter: roleInfo(roles.arbiter),
            },
            userId,
          ),
        counterpartyLabel:
          str(rec(meta.parties).counterpartyLabel) ?? str(r.counterpartyLabel),
        createdAt: ms(r.createdAt ?? meta.createdAt),
      };
    })
    .filter((a): a is AgreementSummary => a !== null);
}

export async function getAgreement(id: string, userId: string): Promise<AgreementDetail> {
  const raw = await request<unknown>(
    `/api/agreements/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,
  );
  return normalizeDetail(raw, id, userId);
}

export interface ActionResult {
  state: State;
  remainingARS?: number;
  txHash?: string;
  split?: { toBeneficiary: number; toDepositor: number; fee: number };
}

export async function agreementAction(
  id: string,
  input: { action: Action; userId: string; toBeneficiaryCents?: number; toDepositorCents?: number },
): Promise<ActionResult> {
  const raw = await request<Record<string, unknown>>(
    `/api/agreements/${encodeURIComponent(id)}/action`,
    {
      method: "POST",
      body: JSON.stringify({
        action: input.action,
        userId: input.userId,
        toBeneficiaryARS: input.toBeneficiaryCents,
        toDepositorARS: input.toDepositorCents,
      }),
    },
  );
  const split = rec(raw.split);
  return {
    state: stateOf(raw.state),
    remainingARS: num(raw.remainingARS),
    txHash: str(raw.txHash),
    split:
      num(split.toBeneficiary) !== undefined
        ? {
            toBeneficiary: num(split.toBeneficiary)!,
            toDepositor: num(split.toDepositor) ?? 0,
            fee: num(split.fee) ?? 0,
          }
        : undefined,
  };
}

// ── Pagos simulados (Mock MP) y ledger ────────────────────────────────────────

export interface PaymentRef {
  paymentId: string;
  status: "pending" | "approved" | "rejected" | "refunded";
}

export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface Ledger {
  available: number;
  inEscrow: number;
  withdrawing: number;
  entries: { id: number; bucket: string; kind: string; amountARS: number; createdAt?: string }[];
}

export async function getLedger(userId: string): Promise<Ledger> {
  const raw = await request<Record<string, unknown>>(
    `/api/ledger/${encodeURIComponent(userId)}`,
  );
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  return {
    available: num(raw.available) ?? 0,
    inEscrow: num(raw.inEscrow) ?? 0,
    withdrawing: num(raw.withdrawing) ?? 0,
    entries: entries.map((e) => {
      const r = rec(e);
      return {
        id: num(r.id) ?? 0,
        bucket: str(r.bucket) ?? "",
        kind: str(r.kind) ?? "",
        amountARS: num(r.amountARS) ?? 0,
        createdAt: str(r.createdAt),
      };
    }),
  };
}

async function paymentPost(path: string, payload: unknown): Promise<PaymentRef> {
  const raw = await request<Record<string, unknown>>(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const s = str(raw.status);
  return {
    paymentId: str(raw.paymentId) ?? str(raw.id) ?? "",
    status: s === "approved" || s === "rejected" || s === "refunded" ? s : "pending",
  };
}

export function loadPayment(userId: string, amountCents: number, idem: string) {
  return paymentPost("/api/payments/load", { userId, amountARS: amountCents, idempotencyKey: idem });
}

export function withdrawPayment(userId: string, amountCents: number, idem: string) {
  return paymentPost("/api/payments/withdraw", { userId, amountARS: amountCents, idempotencyKey: idem });
}

export function resolvePayment(paymentId: string, status: "approved" | "rejected") {
  return paymentPost(`/api/payments/${encodeURIComponent(paymentId)}/resolve`, { status });
}
