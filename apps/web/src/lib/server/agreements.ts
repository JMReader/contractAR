import { randomUUID } from "node:crypto";
import {
  keccak256,
  stringToHex,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { AgreementState, Template, type Role } from "../../../../../shared/types";
import { getDb, nowIso } from "./db";
import { ApiError, apiErr } from "./http";
import {
  ESCROW_ABI,
  arsCentsToTokenUnits,
  chainConfig,
  feeCents,
  getPublicClient,
  tokenUnitsToArsCents,
} from "./chain";
import {
  ensureFundable,
  ensureUserAccount,
  eventsFromReceipt,
  signAndSend,
} from "./operator";
import * as ledger from "./ledger";

function stateName(n: number): string {
  return AgreementState[n] ?? `State${n}`;
}

// JSON canónico: claves ordenadas recursivamente → hash estable (D10).
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

export function canonicalJson(doc: unknown): string {
  return JSON.stringify(canon(doc));
}

export function termsHashOf(doc: unknown): Hex {
  return keccak256(stringToHex(canonicalJson(doc)));
}

export interface AgreementMeta {
  id: string;
  template: number;
  state: string;
  creatorUserId: string;
  depositorUserId: string;
  beneficiaryUserId: string;
  arbiterUserId: string;
  creatorAddress: string | null;
  depositorAddress: string | null;
  beneficiaryAddress: string | null;
  arbiterAddress: string | null;
  amountCents: number;
  remainingCents: number;
  termsJson: string;
  termsHash: string;
  outcomeProposerUserId: string | null;
  proposedToBeneficiaryCents: number | null;
  chainId: number | null;
  contractAgreementId: number | null;
  onchainPending: boolean;
  txHashes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface MetaRow {
  id: string;
  template: number;
  state: string;
  creator_user_id: string;
  depositor_user_id: string;
  beneficiary_user_id: string;
  arbiter_user_id: string;
  creator_address: string | null;
  depositor_address: string | null;
  beneficiary_address: string | null;
  arbiter_address: string | null;
  amount_cents: number;
  remaining_cents: number;
  terms_json: string;
  terms_hash: string;
  outcome_proposer_user_id: string | null;
  proposed_to_beneficiary_cents: number | null;
  chain_id: number | null;
  contract_agreement_id: number | null;
  onchain_pending: number;
  tx_hashes: string;
  created_at: string;
  updated_at: string;
}

function rowToMeta(r: MetaRow): AgreementMeta {
  return {
    id: r.id,
    template: r.template,
    state: r.state,
    creatorUserId: r.creator_user_id,
    depositorUserId: r.depositor_user_id,
    beneficiaryUserId: r.beneficiary_user_id,
    arbiterUserId: r.arbiter_user_id,
    creatorAddress: r.creator_address,
    depositorAddress: r.depositor_address,
    beneficiaryAddress: r.beneficiary_address,
    arbiterAddress: r.arbiter_address,
    amountCents: r.amount_cents,
    remainingCents: r.remaining_cents,
    termsJson: r.terms_json,
    termsHash: r.terms_hash,
    outcomeProposerUserId: r.outcome_proposer_user_id,
    proposedToBeneficiaryCents: r.proposed_to_beneficiary_cents,
    chainId: r.chain_id,
    contractAgreementId: r.contract_agreement_id,
    onchainPending: r.onchain_pending === 1,
    txHashes: JSON.parse(r.tx_hashes || "{}") as Record<string, string>,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getMeta(id: string): AgreementMeta {
  const row = getDb().prepare("SELECT * FROM agreements_meta WHERE id = ?").get(id) as
    | MetaRow
    | undefined;
  if (!row) throw new ApiError("NotFound", 404, "El acuerdo no existe.");
  return rowToMeta(row);
}

export function roleOf(meta: AgreementMeta, userId: string): Role | null {
  if (userId === meta.depositorUserId) return "depositor";
  if (userId === meta.beneficiaryUserId) return "beneficiary";
  if (userId === meta.arbiterUserId) return "arbiter";
  if (userId === meta.creatorUserId) return "creator";
  return null;
}

export interface CreateAgreementInput {
  template: number;
  title: string;
  terms: string;
  parties: { creatorLabel: string; counterpartyLabel: string };
  amountARS: number;
  creatorUserId: string;
  depositorUserId: string;
  beneficiaryUserId: string;
  arbiterUserId: string;
  acceptDeadline: string; // ISO
  reviewDeadline: string; // ISO
}

export async function createAgreement(input: CreateAgreementInput): Promise<{
  meta: AgreementMeta;
  txHash?: Hex;
}> {
  const cfg = chainConfig();
  const addresses = {
    creator: ensureUserAccount(input.creatorUserId).address,
    depositor: ensureUserAccount(input.depositorUserId).address,
    beneficiary: ensureUserAccount(input.beneficiaryUserId).address,
    arbiter: ensureUserAccount(input.arbiterUserId).address,
  };

  const termsDoc = {
    version: 1,
    template: input.template,
    title: input.title,
    terms: input.terms,
    parties: input.parties,
    amountARS: input.amountARS,
    feeBps: 100,
    creator: addresses.creator,
    depositor: addresses.depositor,
    beneficiary: addresses.beneficiary,
    arbiter: addresses.arbiter,
    acceptDeadline: input.acceptDeadline,
    reviewDeadline: input.reviewDeadline,
  };
  const termsJson = canonicalJson(termsDoc);
  const termsHash = termsHashOf(termsDoc);

  const id = `agr_${randomUUID()}`;
  let contractAgreementId: number | null = null;
  let onchainPending = true;
  const txHashes: Record<string, string> = {};

  if (cfg.enabled && cfg.escrowAddress) {
    const res = await signAndSend(input.creatorUserId, {
      to: cfg.escrowAddress,
      abi: ESCROW_ABI,
      functionName: "create",
      args: [
        input.template,
        addresses.depositor,
        addresses.beneficiary,
        addresses.arbiter,
        arsCentsToTokenUnits(input.amountARS),
        termsHash,
        BigInt(Math.floor(Date.parse(input.acceptDeadline) / 1000)),
        BigInt(Math.floor(Date.parse(input.reviewDeadline) / 1000)),
      ],
    });
    txHashes.create = res.txHash;
    const events = eventsFromReceipt(res.receipt, ESCROW_ABI as never, "AgreementCreated");
    const created = events[0]?.args as { id?: bigint } | undefined;
    contractAgreementId = created?.id !== undefined ? Number(created.id) : null;
    onchainPending = false;
  }

  const now = nowIso();
  getDb()
    .prepare(
      `INSERT INTO agreements_meta (
        id, template, state,
        creator_user_id, depositor_user_id, beneficiary_user_id, arbiter_user_id,
        creator_address, depositor_address, beneficiary_address, arbiter_address,
        amount_cents, remaining_cents, terms_json, terms_hash,
        chain_id, contract_agreement_id, onchain_pending, tx_hashes,
        created_at, updated_at
      ) VALUES (?, ?, 'Created', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      input.template,
      input.creatorUserId,
      input.depositorUserId,
      input.beneficiaryUserId,
      input.arbiterUserId,
      addresses.creator,
      addresses.depositor,
      addresses.beneficiary,
      addresses.arbiter,
      input.amountARS,
      input.amountARS,
      termsJson,
      termsHash,
      cfg.enabled ? cfg.chainId : null,
      contractAgreementId,
      onchainPending ? 1 : 0,
      JSON.stringify(txHashes),
      now,
      now,
    );
  return { meta: getMeta(id), txHash: txHashes.create as Hex | undefined };
}

// Estado onchain del acuerdo, si hay contrato cableado. null si no se puede leer.
async function readChainState(
  meta: AgreementMeta,
): Promise<{ state: string; remainingCents: number } | null> {
  const cfg = chainConfig();
  if (!cfg.enabled || !cfg.escrowAddress || meta.contractAgreementId === null) return null;
  try {
    const client = getPublicClient(cfg);
    const ag = (await client.readContract({
      address: cfg.escrowAddress,
      abi: ESCROW_ABI,
      functionName: "agreements",
      args: [BigInt(meta.contractAgreementId)],
    })) as { state: number; remaining: bigint };
    return { state: stateName(Number(ag.state)), remainingCents: tokenUnitsToArsCents(ag.remaining) };
  } catch {
    return null;
  }
}

function saveMeta(meta: AgreementMeta): void {
  getDb()
    .prepare(
      `UPDATE agreements_meta SET
        state = ?, remaining_cents = ?, outcome_proposer_user_id = ?,
        proposed_to_beneficiary_cents = ?, contract_agreement_id = ?,
        onchain_pending = ?, tx_hashes = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      meta.state,
      meta.remainingCents,
      meta.outcomeProposerUserId,
      meta.proposedToBeneficiaryCents,
      meta.contractAgreementId,
      meta.onchainPending ? 1 : 0,
      JSON.stringify(meta.txHashes),
      nowIso(),
      meta.id,
    );
}

export type AgreementAction =
  | "accept"
  | "cancel"
  | "fund"
  | "proposeOutcome"
  | "acceptOutcome"
  | "dispute"
  | "rule"
  | "refundAfterTimeout";

const ACTIONS: AgreementAction[] = [
  "accept",
  "cancel",
  "fund",
  "proposeOutcome",
  "acceptOutcome",
  "dispute",
  "rule",
  "refundAfterTimeout",
];

export interface ActionInput {
  action: AgreementAction;
  userId: string;
  toBeneficiaryARS?: number;
  toDepositorARS?: number;
}

export interface ActionResult {
  meta: AgreementMeta;
  action: AgreementAction;
  txHash?: Hex;
  txHashes?: Hex[];
  disputeId?: number;
  split?: { toBeneficiary: number; toDepositor: number; fee: number };
}

function termsDeadline(meta: AgreementMeta, field: "acceptDeadline" | "reviewDeadline"): Date {
  const doc = JSON.parse(meta.termsJson) as Record<string, unknown>;
  return new Date(String(doc[field]));
}

export async function applyAction(id: string, input: ActionInput): Promise<ActionResult> {
  const meta = getMeta(id);
  const role = roleOf(meta, input.userId);
  if (!role) throw apiErr("NotAuthorized", 403);

  const cfg = chainConfig();
  const live = cfg.enabled && meta.contractAgreementId !== null;
  const chain = live ? await readChainState(meta) : null;
  const state = chain?.state ?? meta.state;

  const assertState = (...allowed: string[]) => {
    if (!allowed.includes(state)) throw apiErr("InvalidState", 409);
  };
  const assertRole = (...allowed: Role[]) => {
    if (!allowed.includes(role)) throw apiErr("NotAuthorized", 403);
  };

  let txHash: Hex | undefined;
  let txHashes: Hex[] | undefined;
  let disputeId: number | undefined;
  let split: { toBeneficiary: number; toDepositor: number; fee: number } | undefined;

  const escrowCall = async (functionName: string, args: readonly unknown[], signerUserId: string) => {
    const res = await signAndSend(signerUserId, {
      to: cfg.escrowAddress!,
      abi: ESCROW_ABI,
      functionName,
      args,
    });
    return res;
  };

  switch (input.action) {
    case "accept": {
      assertRole("depositor");
      assertState("Created");
      if (new Date() > termsDeadline(meta, "acceptDeadline")) {
        throw apiErr("DeadlinePassed", 409);
      }
      if (live) txHash = (await escrowCall("accept", [BigInt(meta.contractAgreementId!)], input.userId)).txHash;
      commit(meta, "Accepted", txHash);
      break;
    }

    case "cancel": {
      const expired = new Date() > termsDeadline(meta, "acceptDeadline");
      // cancel: creator en Created|Accepted; cancelExpired: cualquiera de las partes si venció.
      const allowed =
        (role === "creator" && (state === "Created" || state === "Accepted")) ||
        (state === "Created" && expired && (role === "depositor" || role === "beneficiary"));
      if (!allowed) {
        throw state === "Created" || state === "Accepted"
          ? apiErr("NotAuthorized", 403)
          : apiErr("InvalidState", 409);
      }
      if (live) txHash = (await escrowCall("cancel", [BigInt(meta.contractAgreementId!)], input.userId)).txHash;
      commit(meta, "Cancelled", txHash);
      break;
    }

    case "fund": {
      assertRole("depositor");
      assertState("Accepted");
      if (live) {
        txHashes = [];
        const prep = await ensureFundable(input.userId, arsCentsToTokenUnits(meta.remainingCents));
        txHashes.push(...prep.txHashes);
        const res = await escrowCall("fund", [BigInt(meta.contractAgreementId!)], input.userId);
        txHash = res.txHash;
        txHashes.push(res.txHash);
      }
      getDb().transaction(() => {
        ledger.holdForEscrow(meta.depositorUserId, meta.remainingCents, `agr:${id}`, `agr:${id}:fund`);
        meta.state = "Funded";
        if (txHash) meta.txHashes.fund = txHash;
        if (txHashes?.length) meta.txHashes.fundPrep = txHashes.slice(0, -1).join(",");
        saveMeta(meta);
      })();
      break;
    }

    case "proposeOutcome": {
      assertRole("depositor", "beneficiary");
      assertState("Funded", "OutcomeProposed");
      const toBen = input.toBeneficiaryARS;
      if (toBen === undefined || toBen > meta.remainingCents) {
        throw apiErr("WrongAmount", 400);
      }
      if (state === "OutcomeProposed" && meta.outcomeProposerUserId === input.userId) {
        throw apiErr("NotAuthorized", 403, "La otra parte es la que puede reproponer.");
      }
      if (live) {
        txHash = (
          await escrowCall(
            "proposeOutcome",
            [BigInt(meta.contractAgreementId!), arsCentsToTokenUnits(toBen)],
            input.userId,
          )
        ).txHash;
      }
      getDb().transaction(() => {
        meta.state = "OutcomeProposed";
        meta.outcomeProposerUserId = input.userId;
        meta.proposedToBeneficiaryCents = toBen;
        if (txHash) meta.txHashes.proposeOutcome = txHash;
        saveMeta(meta);
      })();
      break;
    }

    case "acceptOutcome": {
      assertRole("depositor", "beneficiary");
      assertState("OutcomeProposed");
      if (meta.outcomeProposerUserId === input.userId) {
        throw apiErr("NotAuthorized", 403, "Sólo la parte que no propuso puede aceptar.");
      }
      const toBen = meta.proposedToBeneficiaryCents ?? 0;
      let res: Awaited<ReturnType<typeof escrowCall>> | undefined;
      if (live) {
        res = await escrowCall("acceptOutcome", [BigInt(meta.contractAgreementId!)], input.userId);
        txHash = res.txHash;
      }
      split = settleSplit(meta, toBen, res ? settledFromReceipt(res.receipt) : null);
      commitSettle(meta, id, split, "acceptOutcome", txHash);
      break;
    }

    case "dispute": {
      assertRole("depositor", "beneficiary");
      assertState("Funded", "OutcomeProposed");
      if (live) {
        const res = await escrowCall("dispute", [BigInt(meta.contractAgreementId!)], input.userId);
        txHash = res.txHash;
        const ev = eventsFromReceipt(res.receipt, ESCROW_ABI as never, "Dispute");
        const d = ev[0]?.args as { disputeId?: bigint } | undefined;
        disputeId = d?.disputeId !== undefined ? Number(d.disputeId) : undefined;
      }
      getDb().transaction(() => {
        meta.state = "Disputed";
        if (txHash) meta.txHashes.dispute = txHash;
        saveMeta(meta);
      })();
      break;
    }

    case "rule": {
      assertRole("arbiter");
      assertState("Disputed");
      const toBen = input.toBeneficiaryARS;
      const toDep = input.toDepositorARS;
      if (toBen === undefined || toDep === undefined) throw apiErr("WrongAmount", 400);
      if (toBen + toDep !== meta.remainingCents) throw apiErr("SplitMismatch", 409);
      let res: Awaited<ReturnType<typeof escrowCall>> | undefined;
      if (live) {
        res = await escrowCall(
          "rule",
          [
            BigInt(meta.contractAgreementId!),
            arsCentsToTokenUnits(toBen),
            arsCentsToTokenUnits(toDep),
          ],
          input.userId,
        );
        txHash = res.txHash;
      }
      split = settleSplit(meta, toBen, res ? settledFromReceipt(res.receipt) : null);
      commitSettle(meta, id, split, "rule", txHash);
      break;
    }

    case "refundAfterTimeout": {
      assertRole("depositor");
      assertState("Funded", "OutcomeProposed");
      if (new Date() <= termsDeadline(meta, "reviewDeadline")) {
        throw apiErr("DeadlineNotPassed", 409);
      }
      if (live) {
        txHash = (
          await escrowCall("refundAfterTimeout", [BigInt(meta.contractAgreementId!)], input.userId)
        ).txHash;
      }
      split = settleSplit(meta, 0, null);
      commitSettle(meta, id, split, "refundAfterTimeout", txHash);
      break;
    }

    default:
      throw apiErr("InvalidState", 400, "Acción desconocida.");
  }

  return { meta: getMeta(id), action: input.action, txHash, txHashes, disputeId, split };
}

function commit(meta: AgreementMeta, state: string, txHash?: Hex): void {
  getDb().transaction(() => {
    meta.state = state;
    if (txHash) meta.txHashes[meta.state.toLowerCase()] = txHash;
    saveMeta(meta);
  })();
}

// Split en centavos. Con chain vivo se usan los montos reales del evento
// Settled; sin chain se calcula sobre remaining del registro local.
function settleSplit(
  meta: AgreementMeta,
  toBeneficiaryCents: number,
  onchain: { toBeneficiary: number; fee: number; toDepositor: number } | null,
): { toBeneficiary: number; toDepositor: number; fee: number } {
  if (onchain) return onchain;
  const toDepositor = meta.remainingCents - toBeneficiaryCents;
  return { toBeneficiary: toBeneficiaryCents, toDepositor, fee: feeCents(toBeneficiaryCents) };
}

function settledFromReceipt(
  receipt: TransactionReceipt,
): { toBeneficiary: number; fee: number; toDepositor: number } | null {
  try {
    const ev = eventsFromReceipt(receipt, ESCROW_ABI as never, "Settled");
    const s = ev[0]?.args as
      | { toBeneficiary?: bigint; fee?: bigint; toDepositor?: bigint }
      | undefined;
    if (!s || s.toBeneficiary === undefined || s.toDepositor === undefined) return null;
    return {
      toBeneficiary: tokenUnitsToArsCents(s.toBeneficiary),
      fee: tokenUnitsToArsCents(s.fee ?? 0n),
      toDepositor: tokenUnitsToArsCents(s.toDepositor),
    };
  } catch {
    return null;
  }
}

// Una liquidación mueve inEscrow → available según el split y actualiza el meta
// en la misma transacción SQLite que las entradas del ledger.
function commitSettle(
  meta: AgreementMeta,
  id: string,
  split: { toBeneficiary: number; toDepositor: number; fee: number },
  action: string,
  txHash?: Hex,
): void {
  const moved = split.toBeneficiary + split.toDepositor;
  getDb().transaction(() => {
    ledger.releaseEscrow(
      {
        depositorId: meta.depositorUserId,
        beneficiaryId: meta.beneficiaryUserId,
        toBeneficiary: split.toBeneficiary,
        toDepositor: split.toDepositor,
        fee: split.fee,
      },
      `agr:${id}`,
      `agr:${id}:settle:${meta.remainingCents}`,
    );
    meta.remainingCents -= moved;
    meta.state = meta.remainingCents <= 0 ? "Settled" : "Funded";
    meta.outcomeProposerUserId = null;
    meta.proposedToBeneficiaryCents = null;
    if (txHash) meta.txHashes[action] = txHash;
    saveMeta(meta);
  })();
}

// Vista pública del acuerdo: metadata + termsHash + estado (onchain si hay
// contrato cableado y responde; si no, el cache local).
export async function agreementView(id: string) {
  const meta = getMeta(id);
  const cfg = chainConfig();
  const chain = await readChainState(meta);
  return {
    agreementId: meta.id,
    template: meta.template,
    state: chain?.state ?? meta.state,
    termsHash: meta.termsHash,
    terms: JSON.parse(meta.termsJson) as Record<string, unknown>,
    roles: {
      creator: { userId: meta.creatorUserId, address: meta.creatorAddress },
      depositor: { userId: meta.depositorUserId, address: meta.depositorAddress },
      beneficiary: { userId: meta.beneficiaryUserId, address: meta.beneficiaryAddress },
      arbiter: { userId: meta.arbiterUserId, address: meta.arbiterAddress },
    },
    amountARS: meta.amountCents,
    remainingARS: chain?.remainingCents ?? meta.remainingCents,
    outcomeProposerUserId: meta.outcomeProposerUserId,
    proposedToBeneficiaryARS: meta.proposedToBeneficiaryCents,
    onchain: {
      pending: meta.onchainPending,
      chainId: meta.chainId,
      escrowAddress: cfg.escrowAddress,
      contractAgreementId: meta.contractAgreementId,
      txHashes: meta.txHashes,
    },
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  };
}

export function isAction(v: string): v is AgreementAction {
  return ACTIONS.includes(v as AgreementAction);
}

export { stateName };

export function templateFrom(v: unknown): number {
  if (v === "guarantee" || v === 0 || v === "0") return Template.Guarantee;
  if (v === "sale" || v === 1 || v === "1") return Template.Sale;
  throw new ApiError("BadRequest", 400, "template debe ser 'guarantee' o 'sale'.");
}
