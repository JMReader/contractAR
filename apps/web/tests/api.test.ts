import { beforeEach, describe, expect, it } from "vitest";
import { resetAll } from "@/lib/server/db";
import { POST as loadPOST } from "@/app/api/payments/load/route";
import { POST as withdrawPOST } from "@/app/api/payments/withdraw/route";
import { GET as paymentGET } from "@/app/api/payments/[id]/route";
import { POST as resolvePOST } from "@/app/api/payments/[id]/resolve/route";
import { GET as ledgerGET } from "@/app/api/ledger/[userId]/route";
import { GET as operatorGET } from "@/app/api/operator/[userId]/route";
import { POST as agreementsPOST } from "@/app/api/agreements/route";
import { GET as agreementGET } from "@/app/api/agreements/[id]/route";
import { POST as actionPOST } from "@/app/api/agreements/[id]/action/route";

beforeEach(() => resetAll());

function post(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const get = () => new Request("http://localhost/api");
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function approveLoad(userId: string, cents: number, key: string) {
  const res = await loadPOST(post({ userId, amountARS: cents, idempotencyKey: key }));
  const { paymentId } = await res.json();
  await resolvePOST(post({ status: "approved" }), params({ id: paymentId }));
}

describe("API /api/payments", () => {
  it("POST load → {paymentId, status:pending}; GET devuelve el registro", async () => {
    const res = await loadPOST(post({ userId: "u1", amountARS: 5000, idempotencyKey: "k" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ paymentId: expect.any(String), status: "pending" });

    const got = await paymentGET(get(), params({ id: body.paymentId }));
    const payment = await got.json();
    expect(payment).toMatchObject({ userId: "u1", kind: "load", amountARS: 5000, status: "pending" });
  });

  it("POST resolve approved acredita y GET /api/ledger refleja el balance", async () => {
    await approveLoad("u2", 12000, "lk");
    const res = await ledgerGET(get(), params({ userId: "u2" }));
    const balance = await res.json();
    expect(balance).toMatchObject({ userId: "u2", available: 12000, inEscrow: 0, withdrawing: 0 });
    expect(Array.isArray(balance.entries)).toBe(true);
  });

  it("POST withdraw crea pending y resolve approved lo completa", async () => {
    await approveLoad("u3", 8000, "lk3");
    const res = await withdrawPOST(post({ userId: "u3", amountARS: 3000, idempotencyKey: "wk" }));
    expect(res.status).toBe(201);
    const { paymentId, status } = await res.json();
    expect(status).toBe("pending");
    const resolved = await resolvePOST(post({ status: "approved" }), params({ id: paymentId }));
    expect((await resolved.json()).status).toBe("approved");
  });

  it("cuerpo inválido → 400 con shape de error", async () => {
    const res = await loadPOST(post({ userId: "u4" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatchObject({ code: expect.any(String), message: expect.any(String) });
  });

  it("pago inexistente → 404 con shape de error", async () => {
    const res = await paymentGET(get(), params({ id: "no-existe" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NotFound");
  });
});

describe("API /api/operator", () => {
  it("GET crea y devuelve la misma dirección efímera por usuario", async () => {
    const a = await (await operatorGET(get(), params({ userId: "op1" }))).json();
    const b = await (await operatorGET(get(), params({ userId: "op1" }))).json();
    expect(a.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(b.address).toBe(a.address);
    expect(a.demo).toBe(true);
  });
});

describe("API /api/agreements", () => {
  const base = {
    template: "guarantee",
    title: "Garantía auto",
    terms: "Sin reclamo salvo daños",
    parties: { creatorLabel: "Rentadora", counterpartyLabel: "Cliente" },
    amountARS: 600_000_00,
    depositorUserId: "cliente",
    beneficiaryUserId: "rentadora",
    arbiterUserId: "arbitro-demo",
  };

  it("POST crea metadata + termsHash + onchainPending (sin chain)", async () => {
    const res = await agreementsPOST(post(base));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      agreementId: expect.any(String),
      state: "Created",
      onchainPending: true,
    });
    expect(body.termsHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("GET devuelve metadata, termsHash y estado", async () => {
    const created = await (await agreementsPOST(post(base))).json();
    const res = await agreementGET(get(), params({ id: created.agreementId }));
    const view = await res.json();
    expect(view).toMatchObject({
      agreementId: created.agreementId,
      termsHash: created.termsHash,
      state: "Created",
      amountARS: 600_000_00,
    });
    expect(view.roles.depositor.userId).toBe("cliente");
    expect(view.onchain.pending).toBe(true);
  });

  it("action: accept → fund mueve ARS a inEscrow; GET lo refleja", async () => {
    const created = await (await agreementsPOST(post(base))).json();
    await approveLoad("cliente", 600_000_00, "pay-1");
    const acc = await actionPOST(
      post({ action: "accept", userId: "cliente" }),
      params({ id: created.agreementId }),
    );
    expect((await acc.json()).state).toBe("Accepted");
    const fund = await actionPOST(
      post({ action: "fund", userId: "cliente" }),
      params({ id: created.agreementId }),
    );
    expect((await fund.json()).state).toBe("Funded");

    const balance = await (await ledgerGET(get(), params({ userId: "cliente" }))).json();
    expect(balance).toMatchObject({ available: 0, inEscrow: 600_000_00 });
  });

  it("action inválida → 400; acuerdo inexistente → 404", async () => {
    const res = await actionPOST(post({ action: "explode", userId: "x" }), params({ id: "agr_x" }));
    expect(res.status).toBe(400);
    const res2 = await actionPOST(post({ action: "accept", userId: "x" }), params({ id: "agr_x" }));
    expect(res2.status).toBe(404);
  });
});
