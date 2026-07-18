import { cleanText } from './contractUtils.js';
import {
  WEB_CANDIDATE_GROUPS,
  evidenceLabel,
  exposed,
  scoreWebCandidate
} from './webCandidateScoring.js';

export { WEB_CANDIDATE_GROUPS } from './webCandidateScoring.js';

export const WEB_CANDIDATE_RANKING_RULES = Object.freeze({
  primary: 'costCompleteness.complete.desc',
  tieBreakers: Object.freeze([
    'evidenceScore.desc',
    'confidenceScore.desc',
    'availabilityScore.desc',
    'compatibilityScore.desc',
    'delivery.maxDays.asc',
    'knownTotal.asc',
    'productTitle.asc',
    'storeName.asc'
  ]),
  warning: 'Preco visivel nao e custo total quando frete ou imposto estao ausentes.'
});

const GROUP_PRIORITY = Object.freeze({
  [WEB_CANDIDATE_GROUPS.COMPLETE]: 3,
  [WEB_CANDIDATE_GROUPS.INCOMPLETE_COST]: 2,
  [WEB_CANDIDATE_GROUPS.WEAK]: 1
});

function rankableCandidate(candidate, request, index) {
  const { costCompleteness, scores, group, totalKnown } = scoreWebCandidate(candidate, request);

  return {
    candidate: {
      ...candidate,
      costCompleteness,
      ranking: {
        group,
        score: { total: Object.values(scores).reduce((sum, value) => sum + value, 0), ...scores },
        criteria: rankingCriteria(candidate, costCompleteness, totalKnown, scores)
      }
    },
    index,
    totalKnown,
    group
  };
}

function rankingCriteria(candidate, costCompleteness, totalKnown, scores) {
  return {
    costCompleteness: costCompleteness.status,
    completeTotalCost: costCompleteness.complete,
    visiblePrice: candidate.visiblePrice,
    shipping: exposed(candidate.shipping) ? 'exposto' : 'ausente',
    taxes: exposed(candidate.taxes) ? 'exposto' : 'ausente',
    totalCost: totalKnown,
    missingCostComponents: costCompleteness.missingComponents,
    evidenceStrength: evidenceLabel(scores.evidence),
    evidenceCount: Array.isArray(candidate.evidence) ? candidate.evidence.length : 0,
    confidenceLevel: candidate.confidence,
    availability: cleanText(candidate.availability || 'precisa confirmacao'),
    delivery: Number.isInteger(candidate.delivery?.maxDays) ? `ate ${candidate.delivery.maxDays} dias` : 'nao exposto',
    compatibilityScore: scores.compatibility,
    title: cleanText(candidate.productTitle),
    storeName: cleanText(candidate.storeName)
  };
}

function compareRanked(left, right) {
  return (
    GROUP_PRIORITY[right.group] - GROUP_PRIORITY[left.group] ||
    right.candidate.ranking.score.completeness - left.candidate.ranking.score.completeness ||
    right.candidate.ranking.score.evidence - left.candidate.ranking.score.evidence ||
    right.candidate.ranking.score.confidence - left.candidate.ranking.score.confidence ||
    right.candidate.ranking.score.availability - left.candidate.ranking.score.availability ||
    right.candidate.ranking.score.compatibility - left.candidate.ranking.score.compatibility ||
    right.candidate.ranking.score.delivery - left.candidate.ranking.score.delivery ||
    (left.totalKnown?.amountCents ?? left.candidate.visiblePrice.amountCents) -
      (right.totalKnown?.amountCents ?? right.candidate.visiblePrice.amountCents) ||
    cleanText(left.candidate.productTitle).localeCompare(cleanText(right.candidate.productTitle)) ||
    cleanText(left.candidate.storeName).localeCompare(cleanText(right.candidate.storeName)) ||
    left.index - right.index
  );
}

function explanation(candidate, position) {
  const criteria = candidate.ranking.criteria;
  const costText = criteria.completeTotalCost
    ? 'custo total completo confirmado'
    : `custo incompleto (${criteria.missingCostComponents.join(', ') || 'confirmacao pendente'}); preco visivel nao e custo total`;

  return `Posicao ${position}: ${costText}; evidencia ${criteria.evidenceStrength}; confianca ${criteria.confidenceLevel}; disponibilidade ${criteria.availability}.`;
}

export function rankWebOfferCandidates(candidates, request = {}) {
  if (!Array.isArray(candidates)) return [];

  return candidates
    .map((candidate, index) => rankableCandidate(candidate, request, index))
    .sort(compareRanked)
    .map((item, index) => ({
      ...item.candidate,
      ranking: {
        ...item.candidate.ranking,
        position: index + 1,
        explanation: explanation(item.candidate, index + 1)
      }
    }));
}
