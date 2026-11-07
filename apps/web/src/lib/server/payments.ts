import { randomUUID } from "node:crypto";
import { getDb, nowIso } from "./db";
import { apiErr } from "./http";
import * as ledger from "./ledger";
import type { Payment, PaymentStatus } from "../../../../../shared/types";

interface PaymentRow {
  id: string;
  user_id: string;
  kind: "load" | "withdraw";
  amount_cents: number;
  status: PaymentStatus;
  idempotency_key: string;
  created_at: string;
  resolved_at: string | null;
}

function rowToPayment(r: PaymentRow): Payment {
  return {
    id: r.id,
    userId: r.user_id,
    kind: r.kind,
    amountARS: r.amount_cents,
    status: r.status,
    idempotencyKey: r.idempotency_key,
    createdAt: r.created_at,
  };
}

export function getPayment(id: string): Payment | null {
  const row = getDb().prepare("SELECT * FROM payments WHERE id = ?").get(id) as
    | PaymentRow
    | undefined;
  return row ? rowToPayment(row) : null;
}

function findByIdemKey(key: string): PaymentRow | undefined {
  return getDb().prepare("SELECT * FROM payments WHERE idempotency_key = ?").get(key) as
    | PaymentRow
    | undefined;
}

function samePayload(row: PaymentRow, userId: string, kind: string, amount: number): boolean {
  return row.user_id === userId && row.kind === kind && row.amount_cents === amount;
}

// POST /api/payments/load — crea el pago pendiente; NO acredita hasta el callback.
export function createLoad(input: {
  userId: string;
  amountARS: number;
  idempotencyKey: string;
}): Payment {
  const { userId, amountARS, idempotencyKey } = input;
  ledger.ensureUser(userId);
  const existing = findByIdemKey(idempotencyKey);
  if (existing) {
    if (samePayload(existing, userId, "load", amountARS)) return rowToPayment(existing);
    throw apiErr("DuplicateOperation", 409);
  }
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO payments (id, user_id, kind, amount_cents, status, idempotency_key, created_at)
       VALUES (?, ?, 'load', ?, 'pending', ?, ?)`,
    )
    .run(id, userId, amountARS, idempotencyKey, nowIso());
  return getPayment(id)!;
}

// POST /api/payments/:id/resolve — callback simulado del procesador.
// Idempotente: mismo resultado devuelve el registro; contrario una vez terminal → 409.
export function resolvePayment(id: string, outcome: "approved" | "rejected"): Payment {
  const row = getDb().prepare("SELECT * FROM payments WHERE id = ?").get(id) as
    | PaymentRow
    | undefined;
  if (!row) throw apiErr("InvalidState", 404, "El pago no existe.");
  if (row.status !== "pending") {
    if (row.status === outcome) return rowToPayment(row);
    throw apiErr("InvalidState", 409, `El pago ya quedó ${row.status}; no acepta otro resultado.`);
  }

  if (outcome === "rejected") {
    if (row.kind === "withdraw") {
      getDb().transaction(() => {
        ledger.releaseWithdraw(row.user_id, row.amount_cents, `pay:${row.id}`, `pay:${row.id}:rej`);
        markResolved(row.id, "rejected");
      })();
    } else {
      markResolved(row.id, "rejected");
    }
    return getPayment(id)!;
  }

  // approved: una sola acreditación/débito por pago, dentro de la misma transacción.
  if (row.kind === "load") {
    getDb().transaction(() => {
      ledger.creditLoad(row.user_id, row.amount_cents, `pay:${row.id}`, `pay:${row.id}:ok`);
      markResolved(row.id, "approved");
    })();
  } else {
    getDb().transaction(() => {
      ledger.debitWithdraw(row.user_id, row.amount_cents, `pay:${row.id}`, `pay:${row.id}:ok`);
      markResolved(row.id, "approved");
    })();
  }
  return getPayment(id)!;
}

function markResolved(id: string, status: PaymentStatus): void {
  getDb()
    .prepare("UPDATE payments SET status = ?, resolved_at = ? WHERE id = ?")
    .run(status, nowIso(), id);
}

// POST /api/payments/withdraw — retiene available → withdrawing; se completa por
// el mismo callback /resolve. Jamás toca inEscrow.
export function createWithdraw(input: {
  userId: string;
  amountARS: number;
  idempotencyKey: string;
}): Payment {
  const { userId, amountARS, idempotencyKey } = input;
  ledger.ensureUser(userId);
  const existing = findByIdemKey(idempotencyKey);
  if (existing) {
    if (samePayload(existing, userId, "withdraw", amountARS)) return rowToPayment(existing);
    throw apiErr("DuplicateOperation", 409);
  }
  const id = randomUUID();
  getDb().transaction(() => {
    ledger.holdWithdraw(userId, amountARS, `pay:${id}`, `pay:${id}:hold`);
    getDb()
      .prepare(
        `INSERT INTO payments (id, user_id, kind, amount_cents, status, idempotency_key, created_at)
         VALUES (?, ?, 'withdraw', ?, 'pending', ?, ?)`,
      )
      .run(id, userId, amountARS, idempotencyKey, nowIso());
  })();
  return getPayment(id)!;
}
