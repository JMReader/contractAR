// Cliente fetch tipado para la capa simulada de ContractAR (apps/web/app/api/**, la implementa H3).
// Rutas según docs/specs/03_INTERFACE_CONTRACT.md §3. Cuando el spec es ambiguo
// (forma exacta de respuesta de agreements), el normalizador acepta variantes
// razonables y los supuestos quedan documentados en cada tipo.
//
// Todos los montos de esta capa son enteros en CENTAVOS ARS. La UI jamás
// muestra unidades de token: esa conversión vive del lado del servidor.

import {
  AgreementState,
  Template,
  toHumanError,
  type Action,
  type ActionAvailability,
  type LedgerBalance,
  type Payment,
  type PaymentStatus,
  type Role,
} from "@contractar/shared";

// ── Errores ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  /** Texto en castellano listo para mostrar (mapa de shared/errors). */
  readonly human: string;

  constructor(code: string, status: number) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.human = toHumanError(code);
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
  if (typeof b.code === "string") return b.code;
  if (typeof b.reason === "string") return b.reason;
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("network", 0);
  }
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (!res.ok) {
    throw new ApiError(errorCodeFrom(body) ?? `HTTP_${res.status}`, res.status);
  }
  return body as T;
}

// ── Helpers de normalización (defensivos: la API se construye en paralelo) ────

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}
/** Centavos ARS: acepta amountCents, amountARS o amount (ya en centavos). */
function cents(v: Record<string, unknown>): number {
  return num(v.amountCents) ?? num(v.amountARS) ?? num(v.amount) ?? 0;
}
/** Timestamps: acepta ms, segundos unix o ISO. Devuelve ms. */
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
function stateOf(v: unknown): AgreementState {
  const n = num(v);
  if (n !== undefined && n >= 0 && n <= 8) return n as AgreementState;
  const s = str(v)?.toLowerCase();
  const map: Record<string, AgreementState> = {
    none: AgreementState.None,
    created: AgreementState.Created,
    accepted: AgreementState.Accepted,
    funded: AgreementState.Funded,
    outcomeproposed: AgreementState.OutcomeProposed,
    outcome_proposed: AgreementState.OutcomeProposed,
    disputed: AgreementState.Disputed,
    settled: AgreementState.Settled,
    cancelled: AgreementState.Cancelled,
    resolved: AgreementState.Resolved,
  };
  return (s && map[s]) || AgreementState.None;
}
function templateOf(v: unknown): Template {
  const n = num(v);
  if (n === 1) return Template.Sale;
  if (n === 0) return Template.Guarantee;
  const s = str(v)?.toLowerCase();
  if (s === "sale" || s === "entrada" || s === "compraventa") return Template.Sale;
  return Template.Guarantee;
}
function roleOf(v: unknown): Role | undefined {
  const s = str(v);
  if (s === "creator" || s === "depositor" || s === "beneficiary" || s === "arbiter") return s;
  return undefined;
}
function actionOf(v: unknown): Action | undefined {
  const s = str(v);
  const ok: Action[] = [
    "accept", "cancel", "fund", "proposeOutcome",
    "acceptOutcome", "dispute", "rule", "refundAfterTimeout",
  ];
  return ok.find((a) => a === s);
}

// ── Identidad de demostración ────────────────────────────────────────────────
// Sin auth en el MVP: cada navegador representa una persona de la demo con un
// userId estable en localStorage. La API lo usa para el ledger, pagos y roles.
// SUPUESTO: H3 consume `userId` por query/body; si llega otra auth se reemplaza
// sólo esta función.

const DEMO_USER_KEY = "contractar.demoUserId";

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function getDemoUserId(): string {
  if (typeof window === "undefined") return "demo-visitante";
  let id = window.localStorage.getItem(DEMO_USER_KEY);
  if (!id) {
    id = `demo-${crypto.randomUUID().slice(0, 8)}`;
    window.localStorage.setItem(DEMO_USER_KEY, id);
  }
  return id;
}

// ── Agreements ───────────────────────────────────────────────────────────────

export interface TimelineEntry {
  label: string;
  at?: number; // ms
  txHash?: string;
}

export interface OutcomeProposal {
  proposerRole?: Role;
  proposerLabel?: string;
  proposerUserId?: string;
  toBeneficiaryCents: number;
}

export interface Settlement {
  toBeneficiaryCents: number;
  toDepositorCents: number;
  feeCents: number;
  txHash?: string;
}

/** Ficha normalizada que consumen las vistas. */
export interface AgreementDetail {
  id: string;
  template: Template;
  state: AgreementState;
  title: string;
  terms: string;
  amountCents: number;
  /** Saldo aún no liquidado en centavos (si la API lo expone); default = amountCents. */
  remainingCents: number;
  parties: { creatorLabel: string; counterpartyLabel: string };
  yourRole: Role | null;
  roleAddresses: Partial<Record<Role, string>>;
  deadlines: { acceptAt?: number; reviewAt?: number }; // ms
  termsHash?: string;
  termsHashVerified: boolean | null;
  proposal: OutcomeProposal | null;
  settlement: Settlement | null;
  timeline: TimelineEntry[];
  actions: ActionAvailability[];
  network: { chainId?: number; escrow?: string; token?: string };
  txHash?: string;
  createdAt?: number;
  demo: boolean;
}

export interface AgreementSummary {
  id: string;
  title: string;
  template: Template;
  state: AgreementState;
  amountCents: number;
  yourRole: Role | null;
  counterpartyLabel?: string;
  nextStep?: string;
  createdAt?: number;
}

export interface CreateAgreementInput {
  userId: string;
  template: Template;
  title: string;
  counterpartyLabel: string;
  /** Entero en centavos ARS. */
  amountCents: number;
  terms: string;
  /** Segundos unix absolutos (el contrato usa uint40 timestamps). */
  acceptDeadlineSec: number;
  reviewDeadlineSec: number;
}

export interface CreateAgreementResponse {
  id: string;
  termsHash?: string;
  sharePath?: string;
}

function normalizeActions(raw: unknown): ActionAvailability[] {
  if (!Array.isArray(raw)) return [];
  const out: ActionAvailability[] = [];
  for (const item of raw) {
    const r = rec(item);
    const action = actionOf(r.action);
    if (action) {
      out.push({
        action,
        enabled: r.enabled !== false,
        reason: str(r.reason),
      });
    }
  }
  return out;
}

function normalizeTimeline(raw: unknown): TimelineEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): TimelineEntry | null => {
      const r = rec(item);
      const label = str(r.label) ?? str(r.event) ?? str(r.kind);
      if (!label) return null;
      return { label, at: ms(r.at ?? r.timestamp ?? r.createdAt), txHash: str(r.txHash) };
    })
    .filter((e) => e !== null);
}

function normalizeRoles(raw: unknown): Partial<Record<Role, string>> {
  const out: Partial<Record<Role, string>> = {};
  for (const role of ["creator", "depositor", "beneficiary", "arbiter"] as Role[]) {
    const v = rec(raw)[role];
    const addr = str(v) ?? str(rec(v).address);
    if (addr) out[role] = addr;
  }
  return out;
}

/**
 * SUPUESTO de forma: `GET /api/agreements/:id` puede devolver la ficha plana
 * o `{ metadata, agreement|onchain, ... }`. Este normalizador acepta ambas.
 */
export function normalizeAgreementDetail(raw: unknown, fallbackId: string): AgreementDetail {
  const root = rec(raw);
  const meta = rec(root.metadata ?? root.meta);
  const on = rec(root.agreement ?? root.onchain);
  const merged: Record<string, unknown> = { ...on, ...root };

  const parties = rec(meta.parties ?? merged.parties);
  const proposal = rec(root.proposal ?? root.outcome);
  const settlement = rec(root.settlement ?? root.settled);
  const deadlines = rec(root.deadlines);

  return {
    id: str(merged.id) ?? str(merged.agreementId) ?? fallbackId,
    template: templateOf(merged.template ?? meta.template),
    state: stateOf(merged.state ?? on.state),
    title: str(merged.title) ?? str(meta.title) ?? "Acuerdo",
    terms: str(merged.terms) ?? str(meta.terms) ?? "",
    amountCents: cents(merged) || cents(meta),
    remainingCents:
      num(merged.remainingCents) ?? num(merged.remainingARS) ?? (cents(merged) || cents(meta)),
    parties: {
      creatorLabel: str(parties.creatorLabel) ?? "Quien propone",
      counterpartyLabel: str(parties.counterpartyLabel) ?? "La otra parte",
    },
    yourRole: roleOf(merged.yourRole ?? merged.role) ?? null,
    roleAddresses: {
      ...normalizeRoles(merged.roles),
      ...normalizeRoles(on),
    },
    deadlines: {
      acceptAt: ms(deadlines.acceptAt ?? merged.acceptDeadline ?? on.acceptDeadline),
      reviewAt: ms(deadlines.reviewAt ?? merged.reviewDeadline ?? on.reviewDeadline),
    },
    termsHash: str(merged.termsHash ?? on.termsHash),
    termsHashVerified:
      typeof merged.termsHashVerified === "boolean" ? merged.termsHashVerified : null,
    proposal:
      proposal && Object.keys(proposal).length > 0
        ? {
            proposerRole: roleOf(proposal.proposerRole ?? proposal.proposer),
            proposerLabel: str(proposal.proposerLabel),
            proposerUserId: str(proposal.proposerUserId),
            toBeneficiaryCents: num(proposal.toBeneficiaryCents) ?? num(proposal.toBeneficiaryARS) ?? 0,
          }
        : null,
    settlement:
      settlement && Object.keys(settlement).length > 0
        ? {
            toBeneficiaryCents:
              num(settlement.toBeneficiaryCents) ?? num(settlement.toBeneficiaryARS) ?? 0,
            toDepositorCents:
              num(settlement.toDepositorCents) ?? num(settlement.toDepositorARS) ?? 0,
            feeCents: num(settlement.feeCents) ?? num(settlement.feeARS) ?? 0,
            txHash: str(settlement.txHash),
          }
        : null,
    timeline: normalizeTimeline(root.timeline ?? root.events),
    actions: normalizeActions(root.actions ?? root.availableActions),
    network: {
      chainId: num(rec(root.network).chainId ?? merged.chainId),
      escrow: str(rec(root.network).escrow ?? merged.escrowAddress ?? merged.escrow),
      token: str(rec(root.network).token ?? merged.tokenAddress ?? merged.token),
    },
    txHash: str(merged.txHash ?? merged.createdTxHash),
    createdAt: ms(merged.createdAt ?? meta.createdAt),
    demo: merged.demo !== false, // la capa es simulada por defecto
  };
}

export async function createAgreement(input: CreateAgreementInput): Promise<CreateAgreementResponse> {
  const raw = await request<Record<string, unknown>>("/api/agreements", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const r = rec(raw);
  return {
    id: str(r.id) ?? str(r.agreementId) ?? "",
    termsHash: str(r.termsHash),
    sharePath: str(r.sharePath) ?? str(r.shareUrl),
  };
}

/** SUPUESTO: `GET /api/agreements?userId=` devuelve `{agreements:[]}` o un array plano. */
export async function listAgreements(userId: string): Promise<AgreementSummary[]> {
  const raw = await request<unknown>(`/api/agreements?userId=${encodeURIComponent(userId)}`);
  const items = Array.isArray(raw) ? raw : rec(raw).agreements;
  if (!Array.isArray(items)) return [];
  return items
    .map((item): AgreementSummary | null => {
      const r = rec(item);
      const meta = rec(r.metadata);
      const id = str(r.id) ?? str(r.agreementId);
      if (!id) return null;
      return {
        id,
        title: str(r.title) ?? str(meta.title) ?? "Acuerdo",
        template: templateOf(r.template ?? meta.template),
        state: stateOf(r.state),
        amountCents: cents(r) || cents(meta),
        yourRole: roleOf(r.yourRole ?? r.role) ?? null,
        counterpartyLabel: str(rec(meta.parties).counterpartyLabel) ?? str(r.counterpartyLabel),
        nextStep: str(r.nextStep),
        createdAt: ms(r.createdAt ?? meta.createdAt),
      };
    })
    .filter((a) => a !== null);
}

export async function getAgreement(id: string, userId?: string): Promise<AgreementDetail> {
  const q = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const raw = await request<unknown>(`/api/agreements/${encodeURIComponent(id)}${q}`);
  return normalizeAgreementDetail(raw, id);
}

// ── Acciones del acuerdo (firma el operador de demo server-side) ──────────────

export type AgreementActionInput = {
  userId: string;
  action: Action;
  /** Sólo proposeOutcome / rule: reparto en centavos. */
  toBeneficiaryCents?: number;
  toDepositorCents?: number;
  reason?: string;
};

export type TxStatus = "submitted" | "confirming" | "confirmed" | "failed";

export interface AgreementActionResponse {
  ok: boolean;
  status: TxStatus;
  txHash?: string;
  detail?: AgreementDetail;
}

/** SUPUESTO: `POST /api/agreements/:id/action` responde `{status, txHash?, agreement?}`. */
export async function agreementAction(
  id: string,
  input: AgreementActionInput,
): Promise<AgreementActionResponse> {
  const raw = await request<Record<string, unknown>>(
    `/api/agreements/${encodeURIComponent(id)}/action`,
    { method: "POST", body: JSON.stringify(input) },
  );
  const r = rec(raw);
  const s = str(r.status)?.toLowerCase();
  const status: TxStatus =
    s === "submitted" || s === "confirming" || s === "failed" ? s : "confirmed";
  const detail = r.agreement ?? r.detail;
  return {
    ok: status !== "failed" && r.ok !== false,
    status,
    txHash: str(r.txHash),
    detail: detail ? normalizeAgreementDetail(detail, id) : undefined,
  };
}

// ── Mediación IA (recomendación; el árbitro aplica rule) ─────────────────────

export interface MediationInput {
  depositorEvidence: string;
  beneficiaryEvidence: string;
}

export interface MediationResult {
  toBeneficiaryPct: number;
  toDepositorPct: number;
  confidence: string;
  reasoning: string;
  evidenceMissing: string[];
  /** Unidades mínimas del token, como string (bigint seguro). */
  recommendedToBeneficiary: string;
  recommendedToBeneficiaryCents: number;
  recommendedToDepositorCents: number;
  remainingCents: number;
  model?: string;
  latencyMs?: number;
}

export async function mediateAgreement(
  id: string,
  input: MediationInput,
): Promise<MediationResult> {
  const raw = await request<Record<string, unknown>>(
    `/api/agreements/${encodeURIComponent(id)}/mediate`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return {
    toBeneficiaryPct: num(raw.toBeneficiaryPct) ?? 0,
    toDepositorPct: num(raw.toDepositorPct) ?? 0,
    confidence: str(raw.confidence) ?? "baja",
    reasoning: str(raw.reasoning) ?? "",
    evidenceMissing: Array.isArray(raw.evidenceMissing)
      ? raw.evidenceMissing.filter((item): item is string => typeof item === "string")
      : [],
    recommendedToBeneficiary: String(raw.recommendedToBeneficiary ?? "0"),
    recommendedToBeneficiaryCents: num(raw.recommendedToBeneficiaryCents) ?? 0,
    recommendedToDepositorCents: num(raw.recommendedToDepositorCents) ?? 0,
    remainingCents: num(raw.remainingCents) ?? 0,
    model: str(raw.model),
    latencyMs: num(raw.latencyMs),
  };
}

// ── Pagos simulados (Mock MP) y ledger ────────────────────────────────────────

export interface PaymentRef {
  paymentId: string;
  status: PaymentStatus;
}

function paymentStatusOf(v: unknown): PaymentStatus {
  const s = str(v);
  return s === "approved" || s === "rejected" || s === "refunded" ? s : "pending";
}

export async function loadPayment(input: {
  userId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<PaymentRef> {
  const raw = await request<Record<string, unknown>>("/api/payments/load", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const r = rec(raw);
  return {
    paymentId: str(r.paymentId) ?? str(r.id) ?? "",
    status: paymentStatusOf(r.status),
  };
}

/** Control de demo: simula el callback del procesador. Idempotente. */
export async function resolvePayment(
  paymentId: string,
  outcome: "approved" | "rejected",
): Promise<PaymentRef> {
  const raw = await request<Record<string, unknown>>(
    `/api/payments/${encodeURIComponent(paymentId)}/resolve`,
    { method: "POST", body: JSON.stringify({ outcome }) },
  );
  const r = rec(raw);
  return { paymentId, status: paymentStatusOf(r.status) };
}

export async function getPayment(paymentId: string): Promise<Payment> {
  const raw = await request<Record<string, unknown>>(
    `/api/payments/${encodeURIComponent(paymentId)}`,
  );
  const r = rec(raw);
  return {
    id: str(r.id) ?? paymentId,
    userId: str(r.userId) ?? "",
    kind: str(r.kind) === "withdraw" ? "withdraw" : "load",
    amountARS: num(r.amountARS) ?? num(r.amountCents) ?? 0,
    status: paymentStatusOf(r.status),
    idempotencyKey: str(r.idempotencyKey) ?? "",
    createdAt: str(r.createdAt) ?? "",
  };
}

export async function withdrawPayment(input: {
  userId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<PaymentRef> {
  const raw = await request<Record<string, unknown>>("/api/payments/withdraw", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const r = rec(raw);
  return {
    paymentId: str(r.paymentId) ?? str(r.id) ?? "",
    status: paymentStatusOf(r.status),
  };
}

export async function getLedger(userId: string): Promise<LedgerBalance> {
  const raw = await request<Record<string, unknown>>(
    `/api/ledger/${encodeURIComponent(userId)}`,
  );
  const r = rec(raw);
  return {
    userId,
    available: num(r.available) ?? 0,
    inEscrow: num(r.inEscrow) ?? 0,
    withdrawing: num(r.withdrawing) ?? 0,
  };
}
