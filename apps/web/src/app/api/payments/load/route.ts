import { body, handle, json, reqCents, reqString } from "@/lib/server/http";
import { createLoad } from "@/lib/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mock MP: crea un pago de carga pendiente. Acredita sólo cuando /resolve
// reporte approved (spec 03 — el callback es simulado, no prueba onchain).
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const payment = createLoad({
      userId: reqString(b.userId, "userId"),
      amountARS: reqCents(b.amountARS, "amountARS"),
      idempotencyKey: reqString(b.idempotencyKey, "idempotencyKey"),
    });
    return json({ paymentId: payment.id, status: payment.status, payment }, 201);
  });
}
