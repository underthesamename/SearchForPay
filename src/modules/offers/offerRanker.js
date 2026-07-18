import { calculateTotalCost } from '../pricing/totalCost.js';
import { validateOffer } from './offerValidation.js';

export const TOP_OFFER_LIMIT = 3;

export const RANKING_RULES = Object.freeze({
  maxResults: TOP_OFFER_LIMIT,
  primary: 'totalCost.complete.desc, totalCost.amountCents',
  tieBreakers: Object.freeze([
    'delivery.maxDays.asc',
    'seller.reputationScore.desc',
    'productTitle.asc'
  ]),
  futureInputs: Object.freeze([
    'coupon.fromVerifiedSource',
    'delivery.window',
    'seller.reputation'
  ])
});

function getReputationScore(offer) {
  const score = offer.seller?.reputationScore;
  return typeof score === 'number' ? score : 0;
}

function getReputationLabel(offer) {
  const score = offer.seller?.reputationScore;
  return typeof score === 'number' ? String(score) : 'nao informada';
}

function getMaxDeliveryDays(offer) {
  const maxDays = offer.delivery?.maxDays;
  return typeof maxDays === 'number' ? maxDays : Number.POSITIVE_INFINITY;
}

function getDeliveryLabel(offer) {
  const maxDays = getMaxDeliveryDays(offer);
  return Number.isFinite(maxDays) ? `ate ${maxDays} dias` : 'nao informado';
}

function getConfidenceLabel(offer) {
  return offer.verification?.confidenceLevel || 'provider';
}

function createRankingDetails(offer, position) {
  const basis = offer.totalCost.complete === false ? 'subtotal conhecido, porque o frete nao foi exposto' : 'custo total';

  return {
    position,
    explanation: `Entrou no top 3 na posicao ${position} pelo ${basis}; confianca ${getConfidenceLabel(offer)}; desempates usam prazo, reputacao e titulo.`,
    criteria: {
      totalCost: offer.totalCost,
      completeTotalCost: offer.totalCost.complete !== false,
      maxDeliveryDays: Number.isFinite(getMaxDeliveryDays(offer)) ? getMaxDeliveryDays(offer) : null,
      delivery: getDeliveryLabel(offer),
      confidenceLevel: getConfidenceLabel(offer),
      reputationScore: getReputationScore(offer),
      reputation: getReputationLabel(offer),
      title: offer.productTitle
    }
  };
}

function compareRankedOffers(left, right) {
  return (
    Number(right.totalCost.complete !== false) - Number(left.totalCost.complete !== false) ||
    left.totalCost.amountCents - right.totalCost.amountCents ||
    getMaxDeliveryDays(left) - getMaxDeliveryDays(right) ||
    getReputationScore(right) - getReputationScore(left) ||
    left.productTitle.localeCompare(right.productTitle)
  );
}

function normalizeLimit(value) {
  if (!Number.isInteger(value) || value <= 0) {
    return TOP_OFFER_LIMIT;
  }

  return Math.min(value, TOP_OFFER_LIMIT);
}

export function rankOffers(offers, options = {}) {
  if (!Array.isArray(offers)) {
    return [];
  }

  return offers
    .filter((offer) => validateOffer(offer).valid)
    .map((offer) => ({
      ...offer,
      totalCost: calculateTotalCost(offer),
      rankingBasis: RANKING_RULES
    }))
    .sort(compareRankedOffers)
    .slice(0, normalizeLimit(options.limit))
    .map((offer, index) => ({
      ...offer,
      ranking: createRankingDetails(offer, index + 1)
    }));
}
