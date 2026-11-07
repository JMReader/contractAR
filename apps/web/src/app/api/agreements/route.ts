import { ApiError, body, handle, json, optString, reqCents, reqString } from "@/lib/server/http";
import { createAgreement, templateFrom } from "@/lib/server/agreements";

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
  return new Date(Date.now() + sec * 1000).toISOString();
}

// Crea el acuerdo: metadata canónica → termsHash; llama create() onchain si hay
// escrow configurado, si no queda onchainPending para reconciliar después.
export async function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const parties = (b.parties ?? {}) as Record<string, unknown>;
    const beneficiaryUserId = optString(b.beneficiaryUserId, "beneficiaryUserId");
    const creatorUserId = optString(b.creatorUserId, "creatorUserId") ?? beneficiaryUserId;
    if (!creatorUserId) {
      throw new ApiError("BadRequest", 400, "Falta creatorUserId o beneficiaryUserId.");
    }
    const acceptDeadline = deadlineIso(b, "acceptDeadline", DEFAULT_ACCEPT_SEC);
    const reviewDeadline = deadlineIso(b, "reviewDeadline", DEFAULT_REVIEW_SEC);
    if (Date.parse(reviewDeadline) <= Date.parse(acceptDeadline)) {
      throw new ApiError("BadRequest", 400, "reviewDeadline debe ser posterior a acceptDeadline.");
    }
    const { meta, txHash } = await createAgreement({
      template: templateFrom(b.template),
      title: reqString(b.title, "title"),
      terms: reqString(b.terms, "terms"),
      parties: {
        creatorLabel: reqString(parties.creatorLabel, "parties.creatorLabel"),
        counterpartyLabel: reqString(parties.counterpartyLabel, "parties.counterpartyLabel"),
      },
      amountARS: reqCents(b.amountARS, "amountARS"),
      creatorUserId,
      depositorUserId: reqString(b.depositorUserId, "depositorUserId"),
      beneficiaryUserId: beneficiaryUserId ?? creatorUserId,
      arbiterUserId: reqString(b.arbiterUserId, "arbiterUserId"),
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
