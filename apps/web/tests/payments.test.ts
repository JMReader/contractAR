import { beforeEach, describe, expect, it } from "vitest";
import { resetAll } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import { createLoad, createWithdraw, getPayment, resolvePayment } from "@/lib/server/payments";
import { getBalance, holdForEscrow } from "@/lib/server/ledger";

const U = "user-1";

beforeEach(() => resetAll());

function load(userId: string, cents: number, key: string) {
  return createLoad({ userId, amountARS: cents, idempotencyKey: key });
}

describe("mock MP — cargas", () => {
  it("load crea pending y no acredita hasta approved", () => {
    const p = load(U, 10000, "k1");
    expect(p.status).toBe("pending");
    expect(getBalance(U).available).toBe(0);

    const resolved = resolvePayment(p.id, "approved");
    expect(resolved.status).toBe("approved");
    expect(getBalance(U).available).toBe(10000);
  });

  it("callback duplicado devuelve el mismo registro sin reacreditar", () => {
    const p = load(U, 5000, "k2");
    resolvePayment(p.id, "approved");
    const again = resolvePayment(p.id, "approved");
    expect(again.id).toBe(p.id);
    expect(getBalance(U).available).toBe(5000);
  });

  it("rechazo no acredita y duplicar el rechazo es idempotente", () => {
    const p = load(U, 7000, "k3");
    expect(resolvePayment(p.id, "rejected").status).toBe("rejected");
    expect(resolvePayment(p.id, "rejected").status).toBe("rejected");
    expect(getBalance(U).available).toBe(0);
  });

  it("resultado distinto sobre pago terminal → 409", () => {
    const p = load(U, 1000, "k4");
    resolvePayment(p.id, "approved");
    expect(() => resolvePayment(p.id, "rejected")).toThrowError(ApiError);
    try {
      resolvePayment(p.id, "rejected");
    } catch (e) {
      expect((e as ApiError).code).toBe("InvalidState");
      expect((e as ApiError).status).toBe(409);
    }
  });

  it("callback sobre pago inexistente → 404", () => {
    try {
      resolvePayment("nope", "approved");
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).status).toBe(404);
    }
  });

  it("misma idempotency-key + mismo payload → mismo pago (reintento)", () => {
    const a = load(U, 3000, "k5");
    const b = load(U, 3000, "k5");
    expect(b.id).toBe(a.id);
    expect(getPayment(a.id)!.status).toBe("pending");
  });

  it("misma idempotency-key + payload distinto → DuplicateOperation", () => {
    load(U, 3000, "k6");
    try {
      load(U, 4000, "k6");
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("DuplicateOperation");
    }
  });

  it("reintento de create tras approved devuelve el registro aprobado", () => {
    const p = load(U, 2500, "k7");
    resolvePayment(p.id, "approved");
    const replay = load(U, 2500, "k7");
    expect(replay.id).toBe(p.id);
    expect(replay.status).toBe("approved");
    expect(getBalance(U).available).toBe(2500);
  });

  it("callbacks fuera de orden entre pagos distintos", () => {
    const p1 = load(U, 1000, "k8a");
    const p2 = load(U, 2000, "k8b");
    resolvePayment(p2.id, "approved");
    resolvePayment(p1.id, "rejected");
    expect(getBalance(U).available).toBe(2000);
    expect(getPayment(p1.id)!.status).toBe("rejected");
  });
});

describe("mock MP — retiros", () => {
  function fund(cents: number) {
    const p = load(U, cents, `fund-${cents}`);
    resolvePayment(p.id, "approved");
  }

  it("retiro retiene available → withdrawing y approved lo debita", () => {
    fund(10000);
    const w = createWithdraw({ userId: U, amountARS: 4000, idempotencyKey: "w1" });
    expect(w.status).toBe("pending");
    expect(getBalance(U)).toMatchObject({ available: 6000, withdrawing: 4000 });

    resolvePayment(w.id, "approved");
    expect(getBalance(U)).toMatchObject({ available: 6000, withdrawing: 0 });
  });

  it("retiro duplicado (misma key) no ejecuta dos veces", () => {
    fund(10000);
    const a = createWithdraw({ userId: U, amountARS: 3000, idempotencyKey: "w2" });
    const b = createWithdraw({ userId: U, amountARS: 3000, idempotencyKey: "w2" });
    expect(b.id).toBe(a.id);
    expect(getBalance(U)).toMatchObject({ available: 7000, withdrawing: 3000 });
    resolvePayment(a.id, "approved");
    resolvePayment(a.id, "approved");
    expect(getBalance(U)).toMatchObject({ available: 7000, withdrawing: 0 });
  });

  it("retiro rechazado devuelve el saldo retenido a available", () => {
    fund(5000);
    const w = createWithdraw({ userId: U, amountARS: 5000, idempotencyKey: "w3" });
    resolvePayment(w.id, "rejected");
    expect(getBalance(U)).toMatchObject({ available: 5000, withdrawing: 0 });
  });

  it("retiro sobre saldo bloqueado en escrow → WithdrawLocked", () => {
    fund(6000);
    // Bloqueo manual: simula un acuerdo fondeado.
    holdForEscrow(U, 5000, "agr:test", "agr:test:fund");
    try {
      createWithdraw({ userId: U, amountARS: 5000, idempotencyKey: "w4" });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("WithdrawLocked");
    }
  });

  it("retiro mayor que todo el saldo → InsufficientBalance", () => {
    fund(1000);
    try {
      createWithdraw({ userId: U, amountARS: 9000, idempotencyKey: "w5" });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("InsufficientBalance");
    }
  });
});

