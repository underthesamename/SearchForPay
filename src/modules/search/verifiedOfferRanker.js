import { validateVerifiedOffer } from './verifiedOfferModel.js';

export const WEB_RANKING_RULES = Object.freeze({
  maxResults: 3,
  primary: 'costCompleteness.complete.desc, totalCost.amountCents.asc',
  tieBreakers: Object.freeze([
    'evidenceScore.desc',
    'verification.confidenceLevel.desc',
    'availability.desc',
    'delivery.maxDays.asc',
    'productTitle.asc',
    'seller.name.asc'
  ]),
  requiredState: 'oferta_completa',
  source: 'openai_web_search'
});

function component(label, money) {
  return {
    label,
    amountCents: money.amountCents,
    currency: money.currency,
    required: true,
    exposed: true,
    includedInTotal: true
  };
}

function totalCostForVerifiedOffer(offer) {
  const components = {
    product: component('Produto', offer.price),
    shipping: component('Frete', offer.shipping),
    taxes: component('Imposto', offer.taxes)
  };

  return {
    amountCents: offer.price.amountCents + offer.shipping.amountCents + offer.taxes.amountCents,
    currency: offer.price.currency,
    complete: true,
    missingComponents: [],
    warnings: [],
    formula: 'product + shipping + taxes',
    components: Object.entries(components).map(([key, value]) => ({ key, ...value })),
    breakdown: components,
    costCompleteness: offer.costCompleteness
  };
}

function confidenceScore(offer) {
  const scores = { high: 3, medium: 2, low: 1 };
  return scores[offer.verification?.confidenceLevel] || 0;
}

function confidencePoints(offer) {
  const scores = { high: 100, medium: 70, low: 35 };
  return scores[offer.verification?.confidenceLevel] || 0;
}

function evidenceScore(offer) {
  const evidenceCount = Array.isArray(offer.evidence) ? offer.evidence.length : 0;
  return Math.min(100, 45 + evidenceCount * 25);
}

function evidenceLabel(score) {
  if (score >= 85) return 'forte';
  if (score >= 65) return 'suficiente';
  return 'fraca';
}

function maxDeliveryDays(offer) {
  const maxDays = offer.delivery?.maxDays;
  return Number.isFinite(maxDays) ? maxDays : Number.POSITIVE_INFINITY;
}

function deliveryLabel(offer) {
  const maxDays = maxDeliveryDays(offer);
  return Number.isFinite(maxDays) ? `ate ${maxDays} dias` : 'nao informado';
}

function availabilityScore(offer) {
  return /available|in stock|em estoque|disponivel/.test(String(offer.availability || '').toLowerCase()) ? 1 : 0;
}

function compareVerifiedOffers(left, right) {
  return (
    left.totalCost.amountCents - right.totalCost.amountCents ||
    evidenceScore(right) - evidenceScore(left) ||
    confidenceScore(right) - confidenceScore(left) ||
    availabilityScore(right) - availabilityScore(left) ||
    maxDeliveryDays(left) - maxDeliveryDays(right) ||
    left.productTitle.localeCompare(right.productTitle) ||
    (left.seller?.name || '').localeCompare(right.seller?.name || '')
  );
}

function rankingScores(offer) {
  return {
    completeness: 100,
    evidence: evidenceScore(offer),
    confidence: confidencePoints(offer)
  };
}

function normalizeLimit(value) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, WEB_RANKING_RULES.maxResults) : WEB_RANKING_RULES.maxResults;
}

function rankingDetails(offer, position) {
  const scores = rankingScores(offer);

  return {
    position,
    explanation: `Posicao ${position}: custo total completo confirmado; evidencia ${evidenceLabel(scores.evidence)}; confianca ${offer.verification?.confidenceLevel || 'medium'}; confirme a oferta no site da loja antes de comprar.`,
    score: scores,
    criteria: {
      totalCost: offer.totalCost,
      completeTotalCost: true,
      delivery: deliveryLabel(offer),
      confidenceLevel: offer.verification?.confidenceLevel || 'medium',
      evidenceCount: offer.evidence.length,
      evidenceStrength: evidenceLabel(scores.evidence),
      availability: offer.availability || 'precisa confirmacao',
      compatibility: 'titulo compativel com a busca',
      title: offer.productTitle
    }
  };
}

export function rankVerifiedOffers(offers, options = {}) {
  if (!Array.isArray(offers)) return [];

  return offers
    .filter((offer) => validateVerifiedOffer(offer, { expectedCurrency: options.expectedCurrency }).valid)
    .map((offer) => ({
      ...offer,
      totalCost: totalCostForVerifiedOffer(offer),
      rankingBasis: WEB_RANKING_RULES
    }))
    .sort(compareVerifiedOffers)
    .slice(0, normalizeLimit(options.limit))
    .map((offer, index) => ({
      ...offer,
      ranking: rankingDetails(offer, index + 1)
    }));
}
