import { handle, json } from "@/lib/server/http";
import { agreementView } from "@/lib/server/agreements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Metadata + termsHash + estado (del contrato si está cableado, si no el local).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    return json(await agreementView(id));
  });
}
