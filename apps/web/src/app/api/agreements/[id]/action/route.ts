import { ApiError, body, handle, json, optCents, reqString } from "@/lib/server/http";
import { applyAction, isAction } from "@/lib/server/agreements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Transición del acuerdo firmada por el operador demo con la clave del rol.
// Verifica rol/estado y reconcilia el ledger ARS en la misma operación:
// fund mueve available → inEscrow; settle mueve inEscrow → available.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const b = await body(req);
    const action = reqString(b.action, "action");
    if (!isAction(action)) {
      throw new ApiError("BadRequest", 400, `Acción desconocida: ${action}.`);
    }
    const result = await applyAction(id, {
      action,
      userId: reqString(b.userId, "userId"),
      toBeneficiaryARS: optCents(b.toBeneficiaryARS ?? b.toBeneficiaryCents, "toBeneficiaryARS"),
      toDepositorARS: optCents(b.toDepositorARS ?? b.toDepositorCents, "toDepositorARS"),
    });
    return json({
      agreementId: result.meta.id,
      action: result.action,
      state: result.meta.state,
      remainingARS: result.meta.remainingCents,
      txHash: result.txHash,
      txHashes: result.txHashes,
      disputeId: result.disputeId,
      split: result.split,
    });
  });
}
