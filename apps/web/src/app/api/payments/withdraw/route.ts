import { body, handle, json, reqCents, reqString } from "@/lib/server/http";
import { createWithdraw } from "@/lib/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Retiro de pesos simulados: retiene available → withdrawing y queda pendiente
// del callback /resolve (approved completa, rejected devuelve a available).
// Una sola ejecución por idempotencyKey; nunca toca saldo inEscrow.
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const payment = createWithdraw({
      userId: reqString(b.userId, "userId"),
      amountARS: reqCents(b.amountARS, "amountARS"),
      idempotencyKey: reqString(b.idempotencyKey, "idempotencyKey"),
    });
    return json({ paymentId: payment.id, status: payment.status, payment }, 201);
  });
}
