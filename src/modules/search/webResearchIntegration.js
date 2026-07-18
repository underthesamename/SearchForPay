import { toPublicError } from '../../shared/errors.js';
import {
  assertValidVerifiedOffer,
  createCostCompletenessFromWebCandidate,
  isUnavailableText,
  REVALIDATION_STATUSES,
  rankWebOfferCandidates
} from './searchContracts.js';

export const OPENAI_WEB_PROVIDER_NAME = 'openaiweb';
export const OPENAI_WEB_SOURCE = Object.freeze({
  type: 'web_search',
  name: 'OpenAI Web Search',
  url: 'https://developers.openai.com/api/docs/guides/tools-web-search'
});

function publicWebResearchError(error) {
  const publicError = toPublicError(error);

  return {
    status: 'failed',
    providerName: OPENAI_WEB_PROVIDER_NAME,
    message: publicError.message,
    details: publicError.details
  };
}

function toResearchInput(request) {
  return {
    query: request.query,
    postalCode: request.context.postalCode,
    country: request.context.country,
    currency: request.context.currency
  };
}

function completeCandidate(candidate) {
  const costCompleteness = candidate.costCompleteness || createCostCompletenessFromWebCandidate(candidate);

  return (
    [REVALIDATION_STATUSES.CONFIRMED, REVALIDATION_STATUSES.CHANGED].includes(candidate.revalidation?.status) &&
    candidate.shipping?.exposed === true &&
    candidate.taxes?.exposed === true &&
    costCompleteness.complete === true &&
    !isUnavailableText(candidate.availability)
  );
}

function cleanText(value, maxLength = 260) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function money(value) {
  return {
    amountCents: value.amountCents,
    currency: value.currency
  };
}

function deliveryFromCandidate(delivery) {
  if (!delivery || !Number.isInteger(delivery.maxDays) || delivery.maxDays < 0) return undefined;

  return {
    minDays: Number.isInteger(delivery.minDays) && delivery.minDays >= 0 ? delivery.minDays : undefined,
    maxDays: delivery.maxDays
  };
}

function evidenceFromCandidate(candidate) {
  return candidate.evidence.map((item) => ({
    field: item.field || 'offer',
    url: item.url,
    title: cleanText(item.title),
    snippet: cleanText(item.snippet, 360),
    accessedAt: item.accessedAt
  }));
}

function queryMatchesCandidate(candidate, request) {
  const title = cleanText(candidate.productTitle).toLowerCase();
  const tokens = request.normalizedQuery.split(/\s+/).filter((token) => token.length > 2);

  return tokens.length === 0 || tokens.some((token) => title.includes(token));
}

function verifiedOfferFromCandidate(candidate, request) {
  if (!completeCandidate(candidate) || candidate.visiblePrice.currency !== request.context.currency) return undefined;
  if (!queryMatchesCandidate(candidate, request)) return undefined;

  const costCompleteness = candidate.costCompleteness || createCostCompletenessFromWebCandidate(candidate);
  const evidence = evidenceFromCandidate(candidate);
  const offer = {
    model: 'VerifiedOffer',
    modelVersion: 1,
    searchMode: 'web_research',
    offerState: 'oferta_completa',
    providerName: OPENAI_WEB_PROVIDER_NAME,
    source: OPENAI_WEB_SOURCE,
    productTitle: cleanText(candidate.productTitle),
    productUrl: cleanText(candidate.productUrl, 500),
    seller: { name: cleanText(candidate.storeName) },
    storeName: cleanText(candidate.storeName),
    availability: cleanText(candidate.availability || 'precisa confirmacao'),
    price: money(candidate.visiblePrice),
    shipping: money(candidate.shipping),
    taxes: money(candidate.taxes),
    evidence,
    costCompleteness,
    verification: {
      confidenceLevel: candidate.confidence,
      evidence,
      note: 'OpenAI Web Search localizou o candidato; SearchForPay validou custo completo antes do ranking.'
    },
    warnings: [
      'Oferta localizada via OpenAI Web Search; confirme preco, frete, imposto e estoque no site da loja antes de comprar.',
      candidate.revalidation?.status === REVALIDATION_STATUSES.CHANGED ? 'Dados alterados na revalidacao recente; ranking usa a versao revalidada.' : undefined,
      ...candidate.warnings
    ].filter(Boolean)
  };
  offer.lastVerifiedAt = candidate.revalidation?.lastVerifiedAt || null;
  offer.revalidation = candidate.revalidation;
  const delivery = deliveryFromCandidate(candidate.delivery);
  if (delivery) offer.delivery = delivery;

  assertValidVerifiedOffer(offer, { expectedCurrency: request.context.currency });
  return offer;
}

function promoteWebCandidates(candidates, request) {
  const verifiedOffers = candidates
    .map((candidate) => verifiedOfferFromCandidate(candidate, request))
    .filter(Boolean);

  return {
    verifiedOffers,
    promotableCandidates: candidates.filter(completeCandidate).length
  };
}

function normalizeCandidates(candidates, request) {
  const normalized = candidates.map((candidate) => ({
    ...candidate,
    costCompleteness: candidate.costCompleteness || createCostCompletenessFromWebCandidate(candidate)
  }));

  return rankWebOfferCandidates(normalized, request);
}

async function revalidateCandidates(candidates, request, candidateRevalidationService) {
  if (!candidateRevalidationService) {
    return {
      candidates,
      report: {
        status: 'failed',
        providerName: OPENAI_WEB_PROVIDER_NAME,
        message: 'Revalidacao obrigatoria de candidato web nao esta configurada.'
      }
    };
  }

  const revalidated = [];

  for (const candidate of candidates) {
    const revalidation = await candidateRevalidationService.revalidate({
      candidate,
      query: request.query,
      context: request.context
    });
    const current = revalidation.currentCandidate || candidate;
    revalidated.push({
      ...current,
      revalidation,
      lastVerifiedAt: revalidation.lastVerifiedAt,
      costCompleteness: createCostCompletenessFromWebCandidate(current)
    });
  }

  return { candidates: revalidated, report: { status: 'ok' } };
}

function okReport(researchResult, promotion) {
  return {
    status: 'ok',
    providerName: OPENAI_WEB_PROVIDER_NAME,
    totalCandidatesFound: researchResult.meta.totalCandidatesFound,
    validCandidates: researchResult.meta.validCandidates,
    discardedCandidates: researchResult.meta.discardedCandidates,
    warnings: researchResult.meta.warnings,
    searchedAt: researchResult.meta.searchedAt,
    revalidationRequired: true,
    promotableCandidates: promotion.promotableCandidates,
    verifiedOffers: promotion.verifiedOffers.length,
    promotedOffers: promotion.verifiedOffers.length
  };
}

export function isOpenAiWebProvider(provider) {
  return provider.name === OPENAI_WEB_PROVIDER_NAME;
}

export async function runWebResearch({ productResearchService, request, candidateRevalidationService }) {
  if (!productResearchService) {
    return {
      candidates: [],
      verifiedOffers: [],
      report: { status: 'disabled', providerName: OPENAI_WEB_PROVIDER_NAME }
    };
  }

  try {
    const researchResult = await productResearchService.research(toResearchInput(request));
    const rawCandidates = Array.isArray(researchResult.candidates) ? researchResult.candidates : [];
    const revalidation = await revalidateCandidates(rawCandidates, request, candidateRevalidationService);
    if (revalidation.report.status !== 'ok') {
      return { candidates: [], verifiedOffers: [], report: revalidation.report };
    }
    const candidates = normalizeCandidates(revalidation.candidates, request);
    const promotion = promoteWebCandidates(candidates, request);

    return {
      candidates,
      verifiedOffers: promotion.verifiedOffers,
      report: okReport(researchResult, promotion)
    };
  } catch (error) {
    return {
      candidates: [],
      verifiedOffers: [],
      report: publicWebResearchError(error)
    };
  }
}
