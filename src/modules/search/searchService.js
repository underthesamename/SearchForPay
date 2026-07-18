import { RANKING_RULES, TOP_OFFER_LIMIT, rankOffers } from '../offers/offerRanker.js';
import { ServiceUnavailableError } from '../../shared/errors.js';
import { createSearchRequest, createSearchResult, SEARCH_MODES } from './searchModels.js';
import {
  collectProviderOffers,
  getMarketplaceProviders,
  runMarketplaceProviders
} from './providerSearchIntegration.js';
import { runWebResearch } from './webResearchIntegration.js';
import {
  rankVerifiedOffers,
  WEB_CANDIDATE_RANKING_RULES,
  WEB_RANKING_RULES
} from './searchContracts.js';

const EMPTY_PROVIDER_REGISTRY = Object.freeze({
  getUnknownProviders: () => [],
  getDisabledProviders: () => [],
  getEnabledProviders: () => []
});

function webResearchFailure(webResearch) {
  return webResearch.report.status !== 'ok';
}

function disabledProviders(providerRegistry) {
  return providerRegistry.getDisabledProviders?.() || [];
}

function unavailableOpenAiError(webResearch, providerRegistry) {
  return new ServiceUnavailableError('OpenAI Web Search nao esta disponivel para buscar produtos.', {
    searchMode: SEARCH_MODES.WEB_RESEARCH,
    disabledProviders: disabledProviders(providerRegistry),
    webResearch: webResearch.report
  });
}

async function runWebResearchMode({ request, productResearchService, candidateRevalidationService, providerRegistry, maxResults }) {
  const webResearch = await runWebResearch({ productResearchService, request, candidateRevalidationService });

  if (webResearchFailure(webResearch)) {
    throw unavailableOpenAiError(webResearch, providerRegistry);
  }

  const results = rankVerifiedOffers(webResearch.verifiedOffers, {
    limit: Math.min(maxResults, TOP_OFFER_LIMIT),
    expectedCurrency: request.context.currency
  });

  return createSearchResult({
    request,
    results,
    webCandidates: webResearch.candidates,
    meta: {
      generatedAt: new Date().toISOString(),
      normalizedQuery: request.normalizedQuery,
      currency: request.context.currency,
      searchMode: SEARCH_MODES.WEB_RESEARCH,
      rankingRules: WEB_RANKING_RULES,
      webCandidateRankingRules: WEB_CANDIDATE_RANKING_RULES,
      rankingSource: 'openai_web_search',
      providersQueried: 0,
      offersAnalyzed: webResearch.verifiedOffers.length,
      invalidOffersIgnored: 0,
      providerReports: [],
      webResearch: webResearch.report
    }
  });
}

async function runLegacyProviderMode({ request, providerRegistry, maxResults }) {
  const unknownProviders = providerRegistry.getUnknownProviders();
  const disabled = disabledProviders(providerRegistry);

  if (unknownProviders.length > 0) {
    throw new ServiceUnavailableError('Existe provedor legado configurado sem adaptador real.', {
      unknownProviders
    });
  }

  const providers = getMarketplaceProviders(providerRegistry);

  if (providers.length === 0) {
    throw new ServiceUnavailableError('Nenhum provedor legado esta disponivel para buscar produtos.', {
      disabledProviders: disabled
    });
  }

  const providerResults = await runMarketplaceProviders(providers, request);
  const { providerReports, validOffers, invalidOfferCount } = collectProviderOffers(providerResults, request);

  if (
    validOffers.length === 0 &&
    (providerReports.length === 0 || providerReports.every((report) => report.status !== 'ok'))
  ) {
    throw new ServiceUnavailableError('Nenhum provedor legado respondeu com ofertas validas agora.', {
      providers: providerReports
    });
  }

  return createSearchResult({
    request,
    results: rankOffers(validOffers, {
      limit: Math.min(maxResults, TOP_OFFER_LIMIT)
    }),
    webCandidates: [],
    meta: {
      generatedAt: new Date().toISOString(),
      normalizedQuery: request.normalizedQuery,
      currency: request.context.currency,
      searchMode: SEARCH_MODES.LEGACY_PROVIDERS,
      rankingRules: RANKING_RULES,
      rankingSource: 'legacy_providers',
      providersQueried: providers.length,
      offersAnalyzed: validOffers.length,
      invalidOffersIgnored: invalidOfferCount,
      providerReports,
      webResearch: { status: 'not_used', providerName: 'openaiweb' }
    }
  });
}

export function createSearchService({
  providerRegistry = EMPTY_PROVIDER_REGISTRY,
  maxResults = 3,
  productResearchService,
  candidateRevalidationService
} = {}) {
  return {
    async search(input) {
      const request = createSearchRequest(input);

      if (request.searchMode === SEARCH_MODES.LEGACY_PROVIDERS) {
        return await runLegacyProviderMode({ request, providerRegistry, maxResults });
      }

      return await runWebResearchMode({
        request,
        productResearchService,
        candidateRevalidationService,
        providerRegistry,
        maxResults
      });
    }
  };
}
