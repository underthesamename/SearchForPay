import { toPublicError } from '../../shared/errors.js';
import { REVALIDATION_STATUSES } from '../search/searchContracts.js';
import { money, offerEvidence, publicEvidence, totalCostFromCandidate } from './priceAlertEvidence.js';

const ACTIONABLE_REVALIDATION = new Set([
  REVALIDATION_STATUSES.CONFIRMED,
  REVALIDATION_STATUSES.CHANGED
]);

function completeRevalidatedOffer(offer, currency) {
  const revalidationOk = ACTIONABLE_REVALIDATION.has(offer?.revalidation?.status);
  const total = money(offer?.totalCost);

  return Boolean(
    revalidationOk &&
    total &&
    total.currency === currency &&
    offer.totalCost.complete !== false &&
    offer.costCompleteness?.complete !== false &&
    offerEvidence(offer).length > 0
  );
}

function publicBestOffer(offer) {
  if (!offer) return null;

  return {
    providerName: offer.providerName,
    productTitle: offer.productTitle,
    productUrl: offer.productUrl,
    seller: offer.seller,
    storeName: offer.storeName,
    totalCost: offer.totalCost,
    price: offer.price,
    shipping: offer.shipping,
    taxes: offer.taxes,
    availability: offer.availability,
    evidence: offerEvidence(offer),
    lastVerifiedAt: offer.lastVerifiedAt || null,
    revalidation: offer.revalidation || null
  };
}

function lastVerificationFromPayload(payload) {
  const sources = [...(payload.results || []), ...(payload.webCandidates || [])]
    .map((item) => item.revalidation)
    .filter(Boolean)
    .sort((left, right) => new Date(right.lastVerifiedAt).getTime() - new Date(left.lastVerifiedAt).getTime());

  return sources[0] || null;
}

function providerReports(payload) {
  return payload.meta?.providerReports || [];
}

function pendingSearchResult(payload, checkedAt, lastVerification) {
  const foundCandidates = (payload.webCandidates || []).length > 0;

  return {
    status: 'pending',
    checkedAt,
    message: foundCandidates
      ? 'Alerta pendente: a rechecagem encontrou candidatos, mas falta custo completo ou evidencia revalidada.'
      : 'Alerta pendente: nenhuma fonte revalidada mostrou oferta completa agora.',
    bestOffer: null,
    evidence: publicEvidence(lastVerification?.evidence),
    lastVerification,
    providerReports: providerReports(payload),
    webResearch: payload.meta?.webResearch || null
  };
}

function targetReached(alert, totalCost) {
  return totalCost.currency === alert.targetTotalCost.currency &&
    totalCost.amountCents <= alert.targetTotalCost.amountCents;
}

export function resultFromSearchPayload(alert, payload, checkedAt) {
  const lastVerification = lastVerificationFromPayload(payload);
  const bestOffer = (payload.results || [])
    .find((offer) => completeRevalidatedOffer(offer, alert.targetTotalCost.currency));

  if (!bestOffer) {
    return pendingSearchResult(payload, checkedAt, lastVerification);
  }

  const targetMet = targetReached(alert, bestOffer.totalCost);

  return {
    status: targetMet ? 'target_met' : 'target_not_met',
    checkedAt,
    message: targetMet
      ? 'Preco alvo atingido por fonte revalidada com evidencia clicavel.'
      : 'Preco alvo ainda nao foi atingido por fonte revalidada.',
    bestOffer: publicBestOffer(bestOffer),
    evidence: offerEvidence(bestOffer),
    lastVerification,
    providerReports: providerReports(payload),
    webResearch: payload.meta?.webResearch || null
  };
}

function offerFromCandidate(candidate, revalidation) {
  const totalCost = totalCostFromCandidate(candidate);
  if (!totalCost) return null;

  return {
    providerName: 'openaiweb',
    productTitle: candidate.productTitle,
    productUrl: candidate.productUrl,
    seller: { name: candidate.storeName },
    storeName: candidate.storeName,
    totalCost,
    price: candidate.visiblePrice || candidate.price,
    shipping: candidate.shipping,
    taxes: candidate.taxes,
    availability: candidate.availability,
    evidence: publicEvidence(revalidation.evidence || candidate.evidence),
    lastVerifiedAt: revalidation.lastVerifiedAt,
    revalidation
  };
}

export function resultFromCandidateRevalidation(alert, revalidation, checkedAt) {
  const candidate = revalidation.currentCandidate;
  const evidence = publicEvidence(revalidation.evidence || candidate?.evidence);
  const actionable = ACTIONABLE_REVALIDATION.has(revalidation.status);
  const bestOffer = actionable && evidence.length > 0 ? offerFromCandidate(candidate, revalidation) : null;

  if (!bestOffer) {
    return {
      status: 'pending',
      checkedAt,
      message: 'Alerta pendente: candidato rechecado sem oferta completa revalidada.',
      bestOffer: null,
      evidence,
      lastVerification: revalidation
    };
  }

  const targetMet = targetReached(alert, bestOffer.totalCost);

  return {
    status: targetMet ? 'target_met' : 'target_not_met',
    checkedAt,
    message: targetMet
      ? 'Preco alvo atingido por candidato revalidado com evidencia clicavel.'
      : 'Preco alvo ainda nao foi atingido pelo candidato revalidado.',
    bestOffer: publicBestOffer(bestOffer),
    evidence,
    lastVerification: revalidation
  };
}

export function failedResult(error, checkedAt) {
  const publicError = toPublicError(error);

  return {
    status: 'failed',
    checkedAt,
    message: publicError.message,
    error: {
      code: publicError.code,
      details: publicError.details
    }
  };
}
