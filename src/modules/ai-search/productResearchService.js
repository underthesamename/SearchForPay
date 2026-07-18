import { getEnv } from '../../config/env.js';
import { ConfigurationError, ServiceUnavailableError } from '../../shared/errors.js';
import { createOpenAiSearchClient } from './openaiSearchClient.js';
import { createProductResearchRequest } from './productResearchRequest.js';
import {
  getWebCandidatePromotionBlockers,
  validateWebOfferCandidate
} from '../providers/webOfferCandidateModel.js';
import { createCostCompletenessFromWebCandidate } from '../search/searchContracts.js';

const PROVIDER_NAME = 'openaiweb';

function sanitizeWarnings(values) {
  return [...new Set(values
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean))];
}

function candidateWarnings(candidate, blockers) {
  return sanitizeWarnings([
    ...candidate.warnings,
    candidate.shipping.exposed === false ? 'Frete nao exposto; candidato tem custo total incompleto.' : undefined,
    candidate.taxes.exposed === false ? 'Imposto nao confirmado; candidato nao pode virar oferta final.' : undefined,
    ...blockers
  ]);
}

function toValidCandidate(candidate) {
  const promotionBlockers = getWebCandidatePromotionBlockers(candidate);

  return {
    ...candidate,
    researchStatus: {
      type: 'web_candidate',
      rankableOffer: false,
      canProceedToOfferValidation: promotionBlockers.length === 0,
      promotionBlockers,
      warnings: candidateWarnings(candidate, promotionBlockers)
    },
    costCompleteness: createCostCompletenessFromWebCandidate(candidate)
  };
}

function validateCandidates(candidates) {
  const valid = [];
  const discarded = [];

  candidates.forEach((candidate, index) => {
    const validation = validateWebOfferCandidate(candidate);

    if (!validation.valid) {
      discarded.push({ index, errors: validation.errors });
      return;
    }

    valid.push(toValidCandidate(candidate));
  });

  return { valid, discarded };
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolveOpenAiConfig(openAiConfig) {
  return openAiConfig || getEnv().providerOptions.openaiweb;
}

function ensureOpenAiEnabled(config) {
  if (config.enabled !== true) {
    throw new ConfigurationError('OpenAI Search esta desativada para pesquisa de produto.', {
      providerName: PROVIDER_NAME,
      disabled: true,
      reason: config.disabledReason || 'OPENAI_SEARCH_ENABLED=false.'
    });
  }

  if (!config.apiKey || !config.model) {
    throw new ConfigurationError('Configuracao da OpenAI Responses API ausente.', {
      providerName: PROVIDER_NAME,
      required: ['OPENAI_API_KEY', 'OPENAI_SEARCH_MODEL']
    });
  }
}

function createDefaultClient(openAiConfig) {
  return createOpenAiSearchClient({
    ...openAiConfig,
    providerName: PROVIDER_NAME,
    timeoutMs: openAiConfig.requestTimeoutMs
  });
}

export function createProductResearchService(options = {}) {
  const now = options.now || (() => new Date());
  let client;

  function getClient(config) {
    client ||= options.openAiSearchClient || createDefaultClient(config);
    return client;
  }

  return {
    async research(input) {
      const request = createProductResearchRequest(input);
      const config = resolveOpenAiConfig(options.openAiConfig);
      if (!options.openAiSearchClient) ensureOpenAiEnabled(config);

      try {
        const payload = await getClient(config).searchCandidates(request);
        const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
        const { valid, discarded } = validateCandidates(candidates);
        const warnings = sanitizeWarnings(valid.flatMap((candidate) => candidate.researchStatus.warnings));

        return {
          query: request.query,
          normalizedQuery: request.normalizedQuery,
          context: request.context,
          candidates: valid,
          meta: {
            searchMode: 'web_research',
            research: isPlainObject(payload.research) ? payload.research : undefined,
            totalCandidatesFound: candidates.length,
            validCandidates: valid.length,
            discardedCandidates: discarded.length,
            warnings,
            searchedAt: now().toISOString()
          }
        };
      } catch (error) {
        if (error instanceof ConfigurationError || error instanceof ServiceUnavailableError) throw error;
        throw new ServiceUnavailableError('Falha sanitizada ao pesquisar candidatos com OpenAI.', {
          providerName: PROVIDER_NAME
        });
      }
    }
  };
}
