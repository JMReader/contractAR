import { handle, json } from "@/lib/server/http";
import { getBalance, getEntries } from "@/lib/server/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Balances en centavos ARS enteros, derivados del ledger (no del contrato).
export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  return handle(async () => {
    const { userId } = await ctx.params;
    const balance = getBalance(userId);
    return json({ ...balance, entries: getEntries(userId) });
  });
}
