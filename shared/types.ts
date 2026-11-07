// Dominio compartido ContractAR — ver docs/specs/02_FUNDS_STATE_MACHINE.md.
// Fuente de verdad de fondos: el contrato. Este archivo modela lo que la UI lee.

export const FUJI_CHAIN_ID = 43113 as const;

export enum Template {
  Guarantee = 0, // A — garantía (auto): devolución al depositante por defecto
  Sale = 1, // B — compraventa (entrada): liberación al beneficiario por defecto
}

export enum AgreementState {
  None = 0,
  Created = 1,
  Accepted = 2,
  Funded = 3,
  OutcomeProposed = 4,
  Disputed = 5,
  Settled = 6,
  Cancelled = 7,
  Resolved = 8,
}

export interface Agreement {
  template: Template;
  state: AgreementState;
  creator: `0x${string}`;
  depositor: `0x${string}`;
  beneficiary: `0x${string}`;
  arbiter: `0x${string}`;
  /** Depósito inicial en unidades mínimas del token (18 dec). */
  deposit: bigint;
  /** Saldo aún no liquidado. */
  remaining: bigint;
  termsHash: `0x${string}`;
  acceptDeadline: bigint;
  reviewDeadline: bigint;
  outcomeProposer: `0x${string}`;
  proposedToBeneficiary: bigint;
  disputeId: bigint;
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

/** Qué puede hacer cada rol en el estado actual — la UI lo renderiza como "próximo paso". */
export interface ActionAvailability {
  action: Action;
  enabled: boolean;
  reason?: string;
}

// ── Capa simulada (pesos) — etiquetada Demo en UI. Enteros en centavos ARS. ──

export interface LedgerBalance {
  userId: string;
  available: number;
  inEscrow: number;
  withdrawing: number;
}

export type PaymentStatus = "pending" | "approved" | "rejected" | "refunded";

export interface Payment {
  id: string;
  userId: string;
  kind: "load" | "withdraw";
  amountARS: number;
  status: PaymentStatus;
  idempotencyKey: string;
  createdAt: string;
}

export interface AgreementMetadata {
  template: Template;
  title: string;
  terms: string;
  parties: { creatorLabel: string; counterpartyLabel: string };
  amountARS: number;
  createdAt: string;
}
