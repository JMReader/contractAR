import { ApiError, body, handle, json } from "@/lib/server/http";
import { resolvePayment } from "@/lib/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Callback simulado del procesador de pagos. Idempotente: repetir el mismo
// resultado devuelve el registro sin reacreditar; un resultado distinto sobre
// un pago ya terminal da 409.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req);
    const raw =
      b.status ??
      b.outcome ??
      (typeof b.approved === "boolean" ? (b.approved ? "approved" : "rejected") : undefined);
    if (raw !== "approved" && raw !== "rejected") {
      throw new ApiError("BadRequest", 400, "status debe ser 'approved' o 'rejected'.");
    }
    return json(resolvePayment(id, raw));
  });
}
