import { beforeEach, describe, expect, it } from "vitest";
import { resetAll } from "@/lib/server/db";
import { ApiError } from "@/lib/server/http";
import {
  applyAction,
  canonicalJson,
  createAgreement,
  getMeta,
  termsHashOf,
} from "@/lib/server/agreements";
import { createLoad, createWithdraw, resolvePayment } from "@/lib/server/payments";
import { getBalance, PLATFORM_USER_ID } from "@/lib/server/ledger";

const DEPOSITOR = "cliente";
const BENEFICIARY = "rentadora";
const ARBITER = "arbitro-demo";

beforeEach(() => resetAll());

function futureIso(sec: number): string {
  return new Date(Date.now() + sec * 1000).toISOString();
}

function makeAgreement(amountARS = 600_000_00, reviewDeadline = futureIso(86400)) {
  return createAgreement({
    template: 0,
    title: "Garantía de auto",
    terms: "Devolución sin reclamo salvo daños documentados.",
    parties: { creatorLabel: "Rentadora SRL", counterpartyLabel: "Cliente" },
    amountARS,
    creatorUserId: BENEFICIARY,
    depositorUserId: DEPOSITOR,
    beneficiaryUserId: BENEFICIARY,
    arbiterUserId: ARBITER,
    acceptDeadline: futureIso(3600),
    reviewDeadline,
  });
}

function load(userId: string, cents: number, key: string) {
  const p = createLoad({ userId, amountARS: cents, idempotencyKey: key });
  resolvePayment(p.id, "approved");
}

describe("metadata canónica y termsHash", () => {
  it("JSON canónico ordena claves recursivamente → hash estable", () => {
    const a = { b: 1, a: { z: 2, y: [3, { q: 4, p: 5 }] } };
    const b = { a: { y: [3, { p: 5, q: 4 }], z: 2 }, b: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(termsHashOf(a)).toBe(termsHashOf(b));
    expect(termsHashOf(a)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("create guarda meta con termsHash y queda onchainPending sin chain", async () => {
    const { meta } = await makeAgreement(600_000_00);
    expect(meta.state).toBe("Created");
    expect(meta.onchainPending).toBe(true);
    expect(meta.contractAgreementId).toBeNull();
    expect(meta.termsHash).toMatch(/^0x[0-9a-f]{64}$/);
    const doc = JSON.parse(meta.termsJson);
    expect(doc.amountARS).toBe(600_000_00);
    expect(doc.feeBps).toBe(100);
    expect(doc.depositor).toMatch(/^0x[0-9a-fA-F]{40}$/);
    // cambiar el monto cambia el hash (P-06: condiciones ligadas al acuerdo)
    expect(termsHashOf({ ...doc, amountARS: 1 })).not.toBe(meta.termsHash);
  });
});

describe("máquina de estados y permisos", () => {
  it("flujo feliz: accept → fund → proposeOutcome → acceptOutcome → Settled", async () => {
    const { meta } = await makeAgreement(600_000_00);
    load(DEPOSITOR, 600_000_00, "l1");

    expect((await applyAction(meta.id, { action: "accept", userId: DEPOSITOR })).meta.state).toBe("Accepted");
    const funded = await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });
    expect(funded.meta.state).toBe("Funded");
    expect(getBalance(DEPOSITOR)).toMatchObject({ available: 0, inEscrow: 600_000_00 });

    await applyAction(meta.id, {
      action: "proposeOutcome",
      userId: BENEFICIARY,
      toBeneficiaryARS: 180_000_00,
    });
    const settled = await applyAction(meta.id, { action: "acceptOutcome", userId: DEPOSITOR });
    expect(settled.meta.state).toBe("Settled");
    expect(settled.split).toEqual({
      toBeneficiary: 180_000_00,
      toDepositor: 420_000_00,
      fee: 1_800_00, // 1% de 180.000 → centavos
    });

    expect(getBalance(BENEFICIARY).available).toBe(180_000_00 - 1_800_00);
    expect(getBalance(DEPOSITOR)).toMatchObject({ available: 420_000_00, inEscrow: 0 });
    expect(getBalance(PLATFORM_USER_ID).available).toBe(1_800_00);
  });

  it("permisos: sólo el rol correcto ejecuta cada acción", async () => {
    const { meta } = await makeAgreement();
    const cases: [string, string][] = [
      ["accept", BENEFICIARY], // no es el depositante
      ["accept", ARBITER],
      ["cancel", DEPOSITOR], // cancel no vencido: sólo creator
      ["fund", BENEFICIARY],
      ["dispute", ARBITER],
      ["rule", DEPOSITOR],
    ];
    for (const [action, userId] of cases) {
      try {
        await applyAction(meta.id, { action: action as never, userId, toBeneficiaryARS: 1, toDepositorARS: 1 });
        expect.unreachable(`${action} por ${userId} debió fallar`);
      } catch (e) {
        expect((e as ApiError).code).toMatch(/NotAuthorized|InvalidState/);
      }
    }
  });

  it("estado inválido: fund antes de accept, accept duplicado, dispute sin fondos", async () => {
    const { meta } = await makeAgreement();
    try {
      await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("InvalidState");
    }
    await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
    try {
      await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("InvalidState");
    }
    try {
      await applyAction(meta.id, { action: "dispute", userId: DEPOSITOR });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("InvalidState");
    }
  });

  it("fund exige saldo ARS disponible del depositante", async () => {
    const { meta } = await makeAgreement();
    await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
    try {
      await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("InsufficientBalance");
    }
  });

  it("la parte que propuso no puede aceptar su propio outcome", async () => {
    const { meta } = await makeAgreement();
    load(DEPOSITOR, 600_000_00, "l2");
    await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
    await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });
    await applyAction(meta.id, {
      action: "proposeOutcome",
      userId: DEPOSITOR,
      toBeneficiaryARS: 100_000_00,
    });
    try {
      await applyAction(meta.id, { action: "acceptOutcome", userId: DEPOSITOR });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("NotAuthorized");
    }
  });

  it("disputa → rule del árbitro con split exacto cierra el acuerdo", async () => {
    const { meta } = await makeAgreement();
    load(DEPOSITOR, 600_000_00, "l3");
    await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
    await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });
    await applyAction(meta.id, { action: "dispute", userId: BENEFICIARY });
    expect(getMeta(meta.id).state).toBe("Disputed");

    // suma ≠ remaining → SplitMismatch
    try {
      await applyAction(meta.id, {
        action: "rule",
        userId: ARBITER,
        toBeneficiaryARS: 100,
        toDepositorARS: 100,
      });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("SplitMismatch");
    }

    const res = await applyAction(meta.id, {
      action: "rule",
      userId: ARBITER,
      toBeneficiaryARS: 200_000_00,
      toDepositorARS: 400_000_00,
    });
    expect(res.meta.state).toBe("Settled");
    expect(getBalance(BENEFICIARY).available).toBe(200_000_00 - 2_000_00);
    expect(getBalance(PLATFORM_USER_ID).available).toBe(2_000_00);
  });

  it("refundAfterTimeout: antes del plazo falla, después devuelve todo sin fee", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const { meta } = await makeAgreement(600_000_00, past);
    load(DEPOSITOR, 600_000_00, "l4");
    await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
    await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });

    const res = await applyAction(meta.id, { action: "refundAfterTimeout", userId: DEPOSITOR });
    expect(res.meta.state).toBe("Settled");
    expect(res.split).toEqual({ toBeneficiary: 0, toDepositor: 600_000_00, fee: 0 });
    expect(getBalance(DEPOSITOR)).toMatchObject({ available: 600_000_00, inEscrow: 0 });
    expect(getBalance(BENEFICIARY).available).toBe(0);
    expect(getBalance(PLATFORM_USER_ID).available).toBe(0);
  });

  it("refundAfterTimeout antes del vencimiento → DeadlineNotPassed", async () => {
    const { meta } = await makeAgreement();
    load(DEPOSITOR, 600_000_00, "l5");
    await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
    await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });
    try {
      await applyAction(meta.id, { action: "refundAfterTimeout", userId: DEPOSITOR });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("DeadlineNotPassed");
    }
  });
});

describe("reconciliación ARS (conservación)", () => {
  it("load → fund → settle → withdraw conserva totales (fee aparte)", async () => {
    const { meta } = await makeAgreement(600_000_00);
    load(DEPOSITOR, 700_000_00, "l6");
    await applyAction(meta.id, { action: "accept", userId: DEPOSITOR });
    await applyAction(meta.id, { action: "fund", userId: DEPOSITOR });
    await applyAction(meta.id, {
      action: "proposeOutcome",
      userId: BENEFICIARY,
      toBeneficiaryARS: 180_000_00,
    });
    await applyAction(meta.id, { action: "acceptOutcome", userId: DEPOSITOR });

    // Totales: 700.000_00 cargados = 100.000_00 dep disponible + 420.000_00
    // devuelto + 178.200_00 ben + 1.800_00 fee plataforma.
    const dep = getBalance(DEPOSITOR);
    const ben = getBalance(BENEFICIARY);
    const fee = getBalance(PLATFORM_USER_ID).available;
    expect(dep.available + ben.available + fee).toBe(700_000_00);

    // El beneficiario retira su neto.
    const w = createWithdraw({
      userId: BENEFICIARY,
      amountARS: ben.available,
      idempotencyKey: "w-final",
    });
    resolvePayment(w.id, "approved");
    expect(getBalance(BENEFICIARY)).toMatchObject({ available: 0, withdrawing: 0 });
    expect(getBalance(DEPOSITOR).available).toBe(520_000_00);
  });

  it("usuario ajeno al acuerdo no puede actuar", async () => {
    const { meta } = await makeAgreement();
    try {
      await applyAction(meta.id, { action: "accept", userId: "intruso" });
      expect.unreachable();
    } catch (e) {
      expect((e as ApiError).code).toBe("NotAuthorized");
    }
  });
});
