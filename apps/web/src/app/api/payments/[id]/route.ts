import { ApiError, handle, json } from "@/lib/server/http";
import { getPayment } from "@/lib/server/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const payment = getPayment(id);
    if (!payment) throw new ApiError("NotFound", 404, "El pago no existe.");
    return json(payment);
  });
}
