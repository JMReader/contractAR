import { handle, json } from "@/lib/server/http";
import { ensureUserAccount } from "@/lib/server/operator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Operador de demo: cuenta efímera de testnet custodiada por el servicio.
// Devuelve sólo la dirección; la clave jamás sale del keystore local.
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const { userId } = await ctx.params;
    const { address } = ensureUserAccount(userId);
    return json({ userId, address, demo: true });
  });
}
