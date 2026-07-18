import { createCostCompletenessFromWebCandidate, isUnavailableText } from './costCompletenessModel.js';
import { cleanText, hasText, isHttpsUrl } from './contractUtils.js';

export const WEB_CANDIDATE_GROUPS = Object.freeze({
  COMPLETE: 'ofertas_completas',
  INCOMPLETE_COST: 'custo_incompleto',
  WEAK: 'candidatos_fracos'
});

export function exposed(value) {
  return value?.exposed === true && Number.isInteger(value.amountCents);
}

export function knownTotal(candidate, costCompleteness) {
  if (!costCompleteness.complete) return null;

  return {
    amountCents: candidate.visiblePrice.amountCents + candidate.shipping.amountCents + candidate.taxes.amountCents,
    currency: candidate.visiblePrice.currency
  };
}

export function evidenceLabel(score) {
  if (score >= 85) return 'forte';
  if (score >= 65) return 'suficiente';
  return 'fraca';
}

function confidenceScore(candidate) {
  return { high: 100, medium: 70, low: 35 }[candidate.confidence] || 0;
}

function evidenceScore(candidate) {
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.filter((item) => isHttpsUrl(item.url)) : [];
  const hosts = new Set(evidence.map((item) => new URL(item.url).hostname));
  const snippets = evidence.filter((item) => hasText(item.snippet)).length;
  const accessed = evidence.filter((item) => !Number.isNaN(Date.parse(item.accessedAt))).length;

  if (evidence.length === 0) return 0;
  return Math.min(100, 35 + Math.min(evidence.length, 3) * 15 + Math.min(hosts.size, 3) * 8 + snippets * 5 + accessed * 4);
}

function availabilityScore(candidate) {
  const value = cleanText(candidate.availability).toLowerCase();
  if (isUnavailableText(value)) return 0;
  if (/available|in stock|em estoque|disponivel/.test(value)) return 100;
  return 55;
}

function compatibilityScore(candidate, request) {
  const text = `${cleanText(candidate.productTitle)} ${cleanText(candidate.storeName)}`.toLowerCase();
  const tokens = cleanText(request?.normalizedQuery || request?.query).toLowerCase().split(/\s+/).filter((token) => token.length > 2);
  if (tokens.length === 0) return 100;
  return Math.round((tokens.filter((token) => text.includes(token)).length / tokens.length) * 100);
}

function deliveryScore(candidate) {
  const maxDays = candidate.delivery?.maxDays;
  if (!Number.isInteger(maxDays) || maxDays < 0) return 40;
  if (maxDays <= 2) return 100;
  if (maxDays <= 5) return 80;
  if (maxDays <= 10) return 60;
  return 45;
}

function completenessScore(candidate, costCompleteness) {
  return (
    (Number.isInteger(candidate.visiblePrice?.amountCents) ? 20 : 0) +
    (exposed(candidate.shipping) ? 25 : 0) +
    (exposed(candidate.taxes) ? 25 : 0) +
    (costCompleteness.complete ? 30 : 0)
  );
}

function candidateGroup(candidate, scores, costCompleteness) {
  if (isUnavailableText(candidate.availability) || scores.confidence < 50 || scores.evidence < 60 || scores.compatibility < 50) {
    return WEB_CANDIDATE_GROUPS.WEAK;
  }

  return costCompleteness.complete ? WEB_CANDIDATE_GROUPS.COMPLETE : WEB_CANDIDATE_GROUPS.INCOMPLETE_COST;
}

export function scoreWebCandidate(candidate, request = {}) {
  const costCompleteness = candidate.costCompleteness || createCostCompletenessFromWebCandidate(candidate);
  const scores = {
    completeness: completenessScore(candidate, costCompleteness),
    confidence: confidenceScore(candidate),
    evidence: evidenceScore(candidate),
    availability: availabilityScore(candidate),
    compatibility: compatibilityScore(candidate, request),
    delivery: deliveryScore(candidate)
  };

  return {
    costCompleteness,
    scores,
    group: candidateGroup(candidate, scores, costCompleteness),
    totalKnown: knownTotal(candidate, costCompleteness)
  };
}
