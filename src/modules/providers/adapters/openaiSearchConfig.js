import { ConfigurationError } from '../../../shared/errors.js';
import { isHttpsUrl, parsePositiveInteger } from './adapterUtils.js';

export const OPENAI_WEB_PROVIDER_NAME = 'openaiweb';
export const OPENAI_WEB_SOURCE = Object.freeze({
  type: 'api',
  name: 'OpenAI Responses API web_search',
  url: 'https://developers.openai.com/api/docs/guides/tools-web-search'
});

const DEFAULT_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.6';
const DEFAULT_CONTEXT_SIZE = 'high';
const DEFAULT_MAX_CANDIDATES = 8;
const DEFAULT_TIMEOUT_MS = 15000;
const SEARCH_CONTEXT_SIZES = new Set(['low', 'medium', 'high']);

function clean(value) {
  return String(value || '').trim();
}

function parseBoolean(value, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function normalizeContextSize(value) {
  const contextSize = clean(value || DEFAULT_CONTEXT_SIZE).toLowerCase();

  if (!SEARCH_CONTEXT_SIZES.has(contextSize)) {
    throw new ConfigurationError('Tamanho de contexto OpenAI Search invalido.', {
      providerName: OPENAI_WEB_PROVIDER_NAME,
      required: ['OPENAI_SEARCH_CONTEXT_SIZE low|medium|high']
    });
  }

  return contextSize;
}

function normalizeMaxCandidates(value) {
  return Math.min(parsePositiveInteger(value, DEFAULT_MAX_CANDIDATES), 10);
}

export function normalizeOpenAiWebConfig(config = {}) {
  const responsesUrl = clean(config.responsesUrl || DEFAULT_RESPONSES_URL);

  if (!isHttpsUrl(responsesUrl)) {
    throw new ConfigurationError('Endpoint da OpenAI Responses API invalido.', {
      providerName: OPENAI_WEB_PROVIDER_NAME,
      required: ['OPENAI_RESPONSES_URL HTTPS']
    });
  }

  return {
    enabled: config.enabled === true,
    disabledReason: clean(config.disabledReason || 'OPENAI_SEARCH_ENABLED=false.'),
    apiKey: clean(config.apiKey),
    responsesUrl,
    model: clean(config.model || DEFAULT_MODEL),
    contextSize: normalizeContextSize(config.contextSize),
    maxCandidates: normalizeMaxCandidates(config.maxCandidates ?? config.searchLimit),
    requestTimeoutMs: parsePositiveInteger(config.requestTimeoutMs, DEFAULT_TIMEOUT_MS),
    storeResponses: parseBoolean(config.storeResponses, false),
    fetchImpl: config.fetchImpl || fetch
  };
}

export function ensureOpenAiWebConfig(config) {
  if (!config.enabled) {
    throw new ConfigurationError('OpenAI Search esta desativada.', {
      providerName: OPENAI_WEB_PROVIDER_NAME,
      disabled: true,
      reason: config.disabledReason
    });
  }

  if (!config.apiKey || !config.model) {
    throw new ConfigurationError('Configuracao da OpenAI Responses API ausente.', {
      providerName: OPENAI_WEB_PROVIDER_NAME,
      required: ['OPENAI_API_KEY', 'OPENAI_SEARCH_MODEL']
    });
  }
}
