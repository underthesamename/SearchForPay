import { ConfigurationError, ServiceUnavailableError } from '../../shared/errors.js';
import {
  createOpenAiSearchRateLimiter,
  normalizeSearchLimits
} from './openaiSearchLimits.js';
import { createOpenAiWebInput } from './openaiSearchPrompt.js';
import { parseOpenAiCandidatePayload } from './openaiSearchResponse.js';
import { OPENAI_WEB_CANDIDATE_SCHEMA } from './openaiSearchSchema.js';

const DEFAULT_PROVIDER_NAME = 'openaiweb';
const DEFAULT_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_CONTEXT_SIZE = 'high';

function normalizeClientConfig(config) {
  const limits = normalizeSearchLimits(config);

  return {
    providerName: config.providerName || DEFAULT_PROVIDER_NAME,
    apiKey: String(config.apiKey || '').trim(),
    responsesUrl: String(config.responsesUrl || DEFAULT_RESPONSES_URL).trim(),
    model: String(config.model || '').trim(),
    contextSize: config.contextSize || DEFAULT_CONTEXT_SIZE,
    storeResponses: config.storeResponses === true,
    fetchImpl: config.fetchImpl || fetch,
    ...limits
  };
}

function ensureClientConfig(config) {
  if (!config.apiKey || !config.model) {
    throw new ConfigurationError('Configuracao da OpenAI Responses API ausente.', {
      providerName: config.providerName,
      required: ['OPENAI_API_KEY', 'OPENAI_SEARCH_MODEL']
    });
  }
}

export function createOpenAiSearchRequestBody(config, searchRequest) {
  const currentConfig = normalizeClientConfig(config);

  return {
    model: currentConfig.model,
    input: createOpenAiWebInput(searchRequest, currentConfig.maxCandidates),
    tools: [{ type: 'web_search', search_context_size: currentConfig.contextSize }],
    tool_choice: 'auto',
    store: currentConfig.storeResponses,
    text: {
      format: {
        type: 'json_schema',
        name: 'searchforpay_web_candidates',
        strict: true,
        schema: OPENAI_WEB_CANDIDATE_SCHEMA
      }
    }
  };
}

async function readJsonResponse(response, providerName) {
  try {
    return await response.json();
  } catch {
    throw new ServiceUnavailableError('OpenAI Responses API retornou JSON HTTP invalido.', {
      providerName,
      statusCode: response.status
    });
  }
}

function throwHttpError(config, response) {
  const retryAfter = response.headers?.get?.('retry-after');
  const details = {
    providerName: config.providerName,
    statusCode: response.status,
    ...(retryAfter ? { retryAfter } : {})
  };

  if (response.status === 429) {
    throw new ServiceUnavailableError('OpenAI Responses API atingiu limite de uso temporario.', details);
  }

  throw new ServiceUnavailableError('OpenAI Responses API retornou resposta indisponivel.', details);
}

async function fetchOpenAiResponse(config, searchRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await config.fetchImpl(config.responsesUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(createOpenAiSearchRequestBody(config, searchRequest)),
      signal: controller.signal
    });

    if (!response.ok) {
      throwHttpError(config, response);
    }

    return await readJsonResponse(response, config.providerName);
  } catch (error) {
    if (error instanceof ServiceUnavailableError) throw error;

    if (error?.name === 'AbortError') {
      throw new ServiceUnavailableError('Timeout ao consultar OpenAI Responses API.', {
        providerName: config.providerName,
        timeoutMs: config.timeoutMs
      });
    }

    throw new ServiceUnavailableError('Falha sanitizada ao consultar OpenAI Responses API.', {
      providerName: config.providerName
    });
  } finally {
    clearTimeout(timeout);
  }
}

function limitCandidatePayload(payload, maxCandidates) {
  return {
    ...payload,
    candidates: payload.candidates.slice(0, maxCandidates)
  };
}

export function createOpenAiSearchClient(config = {}) {
  const currentConfig = normalizeClientConfig(config);
  const rateLimiter = createOpenAiSearchRateLimiter(currentConfig, config.rateLimitNow);

  return {
    async searchCandidates(searchRequest) {
      ensureClientConfig(currentConfig);
      rateLimiter.assertAllowed();
      const payload = await fetchOpenAiResponse(currentConfig, searchRequest);
      const parsed = parseOpenAiCandidatePayload(payload, {
        providerName: currentConfig.providerName
      });
      return limitCandidatePayload(parsed, currentConfig.maxCandidates);
    }
  };
}
