import { getDb, nowIso } from "./db";
import { apiErr } from "./http";
import type { LedgerBalance } from "../../../../../shared/types";

export type Bucket = "available" | "inEscrow" | "withdrawing";

// Fee de la plataforma se acredita a un usuario sistema: conservación total
// verificable con un SUM global (loads suman, withdraws restan, nada desaparece).
export const PLATFORM_USER_ID = "__platform__";

export interface LedgerEntry {
  id: number;
  userId: string;
  bucket: Bucket;
  kind: string;
  amountARS: number;
  ref: string | null;
  idempotencyKey: string | null;
  txHash: string | null;
  createdAt: string;
}

interface EntryRow {
  id: number;
  user_id: string;
  bucket: Bucket;
  kind: string;
  amount_cents: number;
  ref: string | null;
  idempotency_key: string | null;
  tx_hash: string | null;
  created_at: string;
}

function rowToEntry(r: EntryRow): LedgerEntry {
  return {
    id: r.id,
    userId: r.user_id,
    bucket: r.bucket,
    kind: r.kind,
    amountARS: r.amount_cents,
    ref: r.ref,
    idempotencyKey: r.idempotency_key,
    txHash: r.tx_hash,
    createdAt: r.created_at,
  };
}

export function ensureUser(userId: string): void {
  getDb()
    .prepare("INSERT OR IGNORE INTO users (id, created_at) VALUES (?, ?)")
    .run(userId, nowIso());
}

export function setChainAddress(userId: string, address: string): void {
  ensureUser(userId);
  getDb()
    .prepare("UPDATE users SET chain_address = ? WHERE id = ?")
    .run(address, userId);
}

export function getChainAddress(userId: string): string | null {
  const row = getDb()
    .prepare("SELECT chain_address FROM users WHERE id = ?")
    .get(userId) as { chain_address: string | null } | undefined;
  return row?.chain_address ?? null;
}

export function getBalance(userId: string): LedgerBalance {
  const rows = getDb()
    .prepare(
      "SELECT bucket, COALESCE(SUM(amount_cents), 0) AS total FROM ledger_entries WHERE user_id = ? GROUP BY bucket",
    )
    .all(userId) as { bucket: Bucket; total: number }[];
  const bal: LedgerBalance = { userId, available: 0, inEscrow: 0, withdrawing: 0 };
  for (const r of rows) bal[r.bucket] = r.total;
  return bal;
}

export function getEntries(userId: string, limit = 50): LedgerEntry[] {
  const rows = getDb()
    .prepare("SELECT * FROM ledger_entries WHERE user_id = ? ORDER BY id DESC LIMIT ?")
    .all(userId, limit) as EntryRow[];
  return rows.map(rowToEntry);
}

function insertEntry(e: {
  userId: string;
  bucket: Bucket;
  kind: string;
  amount: number;
  ref?: string;
  idemKey?: string;
  txHash?: string;
}): boolean {
  const res = getDb()
    .prepare(
      `INSERT OR IGNORE INTO ledger_entries
        (user_id, bucket, kind, amount_cents, ref, idempotency_key, tx_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      e.userId,
      e.bucket,
      e.kind,
      e.amount,
      e.ref ?? null,
      e.idemKey ?? null,
      e.txHash ?? null,
      nowIso(),
    );
  return res.changes > 0;
}

function bucketTotal(userId: string, bucket: Bucket): number {
  const row = getDb()
    .prepare(
      "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM ledger_entries WHERE user_id = ? AND bucket = ?",
    )
    .get(userId, bucket) as { total: number };
  return row.total;
}

// Carga acreditada (pago aprobado). Devuelve false si el idem-key ya se aplicó.
export function creditLoad(userId: string, amount: number, ref: string, idemKey: string): boolean {
  ensureUser(userId);
  return getDb().transaction(() =>
    insertEntry({ userId, bucket: "available", kind: "load_credit", amount, ref, idemKey }),
  )();
}

// Fondos hacia un acuerdo: available → inEscrow del depositante.
export function holdForEscrow(userId: string, amount: number, ref: string, idemKey: string): boolean {
  ensureUser(userId);
  return getDb().transaction(() => {
    if (insertEntry({ userId, bucket: "available", kind: "escrow_lock", amount: -amount, ref, idemKey })) {
      if (bucketTotal(userId, "available") < 0) throw apiErr("InsufficientBalance", 409);
      insertEntry({ userId, bucket: "inEscrow", kind: "escrow_lock", amount, ref, idemKey: `${idemKey}:b` });
      return true;
    }
    return false;
  })();
}

export interface SettleSplit {
  depositorId: string;
  beneficiaryId: string;
  toBeneficiary: number; // bruto en centavos, antes del fee
  toDepositor: number;
  fee: number; // centavos a la plataforma, sale de toBeneficiary
}

// Liquidación: sale de inEscrow del depositante y reparte neta/fee/devolución.
export function releaseEscrow(split: SettleSplit, ref: string, idemKey: string): boolean {
  const { depositorId, beneficiaryId, toBeneficiary, toDepositor, fee } = split;
  if (toBeneficiary < 0 || toDepositor < 0 || fee < 0 || fee > toBeneficiary) {
    throw apiErr("SplitMismatch", 409);
  }
  const moved = toBeneficiary + toDepositor;
  ensureUser(depositorId);
  ensureUser(beneficiaryId);
  ensureUser(PLATFORM_USER_ID);
  return getDb().transaction(() => {
    if (!insertEntry({ userId: depositorId, bucket: "inEscrow", kind: "escrow_release", amount: -moved, ref, idemKey })) {
      return false;
    }
    if (bucketTotal(depositorId, "inEscrow") < 0) {
      // Nunca puede salir más de lo que el acuerdo tenía retenido.
      throw apiErr("InvalidState", 409, "El acuerdo no tiene saldo retenido suficiente.");
    }
    insertEntry({ userId: beneficiaryId, bucket: "available", kind: "settle_credit", amount: toBeneficiary - fee, ref, idemKey: `${idemKey}:b` });
    if (toDepositor > 0) {
      insertEntry({ userId: depositorId, bucket: "available", kind: "refund_credit", amount: toDepositor, ref, idemKey: `${idemKey}:d` });
    }
    if (fee > 0) {
      insertEntry({ userId: PLATFORM_USER_ID, bucket: "available", kind: "fee_credit", amount: fee, ref, idemKey: `${idemKey}:f` });
    }
    return true;
  })();
}

// Retiro: retiene available → withdrawing hasta que el procesador resuelve.
export function holdWithdraw(userId: string, amount: number, ref: string, idemKey: string): boolean {
  ensureUser(userId);
  return getDb().transaction(() => {
    if (insertEntry({ userId, bucket: "available", kind: "withdraw_hold", amount: -amount, ref, idemKey })) {
      const avail = bucketTotal(userId, "available");
      if (avail < 0) {
        const locked = bucketTotal(userId, "inEscrow") + bucketTotal(userId, "withdrawing");
        // Deficit = -avail; si el saldo bloqueado lo cubre, el retiro pedía plata
        // protegida o en tránsito → WithdrawLocked; si no, faltan fondos.
        throw avail + locked >= 0 ? apiErr("WithdrawLocked", 409) : apiErr("InsufficientBalance", 409);
      }
      insertEntry({ userId, bucket: "withdrawing", kind: "withdraw_hold", amount, ref, idemKey: `${idemKey}:b` });
      return true;
    }
    return false;
  })();
}

// Retiro aprobado: la plata sale del sistema (débito de withdrawing).
export function debitWithdraw(userId: string, amount: number, ref: string, idemKey: string): boolean {
  return getDb().transaction(() => {
    if (!insertEntry({ userId, bucket: "withdrawing", kind: "withdraw_debit", amount: -amount, ref, idemKey })) {
      return false;
    }
    if (bucketTotal(userId, "withdrawing") < 0) throw apiErr("InvalidState", 409);
    return true;
  })();
}

// Retiro rechazado: el saldo retenido vuelve a available.
export function releaseWithdraw(userId: string, amount: number, ref: string, idemKey: string): boolean {
  return getDb().transaction(() => {
    if (!insertEntry({ userId, bucket: "withdrawing", kind: "withdraw_release", amount: -amount, ref, idemKey })) {
      return false;
    }
    if (bucketTotal(userId, "withdrawing") < 0) throw apiErr("InvalidState", 409);
    insertEntry({ userId, bucket: "available", kind: "withdraw_release", amount, ref, idemKey: `${idemKey}:b` });
    return true;
  })();
}
