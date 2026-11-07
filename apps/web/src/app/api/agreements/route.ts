import { ApiError, body, handle, json, optString, reqCents, reqString } from "@/lib/server/http";
import { createAgreement, listAgreements, templateFrom } from "@/lib/server/agreements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_ACCEPT_SEC = 3600;
const DEFAULT_REVIEW_SEC = 7 * 24 * 3600;

function deadlineIso(
  b: Record<string, unknown>,
  name: "acceptDeadline" | "reviewDeadline",
  defaultSec: number,
): string {
  const iso = optString(b[name], name);
  if (iso) {
    if (Number.isNaN(Date.parse(iso))) {
      throw new ApiError("BadRequest", 400, `${name} no es una fecha ISO válida.`);
    }
    return new Date(iso).toISOString();
  }
  const raw = b[`${name}Sec`];
  const sec = raw === undefined ? defaultSec : raw;
  if (typeof sec !== "number" || !Number.isFinite(sec)) {
    throw new ApiError("BadRequest", 400, `${name}Sec debe ser un número de segundos.`);
  }
  // >1e9 (~año 2001) se interpreta como timestamp unix absoluto; si no, relativo.
  return sec > 1e9
    ? new Date(sec * 1000).toISOString()
    : new Date(Date.now() + sec * 1000).toISOString();
}

// Lista del usuario: acuerdos donde ocupa cualquier rol.
export async function GET(req: Request) {
  return handle(async () => {
    const userId = new URL(req.url).searchParams.get("userId");
    if (!userId) throw new ApiError("BadRequest", 400, "Falta ?userId=.");
    return json(listAgreements(userId));
  });
}

// Crea el acuerdo: metadata canónica → termsHash; llama create() onchain si hay
// escrow configurado, si no queda onchainPending para reconciliar después.
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const parties = (b.parties ?? {}) as Record<string, unknown>;
    const beneficiaryUserId = optString(b.beneficiaryUserId, "beneficiaryUserId");
    // userId (forma corta del cliente) = creador = beneficiario por defecto.
    const creatorUserId =
      optString(b.creatorUserId, "creatorUserId") ?? optString(b.userId, "userId") ?? beneficiaryUserId;
    if (!creatorUserId) {
      throw new ApiError("BadRequest", 400, "Falta creatorUserId o userId.");
    }
    const acceptDeadline = deadlineIso(b, "acceptDeadline", DEFAULT_ACCEPT_SEC);
    const reviewDeadline = deadlineIso(b, "reviewDeadline", DEFAULT_REVIEW_SEC);
    if (Date.parse(reviewDeadline) <= Date.parse(acceptDeadline)) {
      throw new ApiError("BadRequest", 400, "reviewDeadline debe ser posterior a acceptDeadline.");
    }
    const counterpartyLabel =
      optString(parties.counterpartyLabel, "parties.counterpartyLabel") ??
      reqString(b.counterpartyLabel, "counterpartyLabel");
    const { meta, txHash } = await createAgreement({
      template: templateFrom(b.template),
      title: reqString(b.title, "title"),
      terms: reqString(b.terms, "terms"),
      parties: {
        creatorLabel:
          optString(parties.creatorLabel, "parties.creatorLabel") ??
          optString(b.creatorLabel, "creatorLabel") ??
          creatorUserId,
        counterpartyLabel,
      },
      amountARS: reqCents(b.amountARS ?? b.amountCents, "amountARS"),
      creatorUserId,
      // null → la contraparte ocupa el asiento al aceptar por el link.
      depositorUserId: optString(b.depositorUserId, "depositorUserId") ?? null,
      beneficiaryUserId: beneficiaryUserId ?? creatorUserId,
      arbiterUserId: optString(b.arbiterUserId, "arbiterUserId") ?? "arbitro",
      acceptDeadline,
      reviewDeadline,
    });
    return json(
      {
        agreementId: meta.id,
        termsHash: meta.termsHash,
        state: meta.state,
        onchainPending: meta.onchainPending,
        contractAgreementId: meta.contractAgreementId,
        txHash,
      },
      201,
    );
  });
}
