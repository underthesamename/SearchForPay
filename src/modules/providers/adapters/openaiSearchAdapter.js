import { fetchJsonWithTimeout } from './adapterHttp.js';
import {
  OPENAI_WEB_PROVIDER_NAME,
  OPENAI_WEB_SOURCE,
  ensureOpenAiWebConfig,
  normalizeOpenAiWebConfig
} from './openaiSearchConfig.js';
import { createOpenAiWebInput } from './openaiSearchPrompt.js';
import { parseOpenAiCandidatePayload } from './openaiSearchResponse.js';
import { normalizeOpenAiWebCandidates } from './openaiSearchMapper.js';
import { OPENAI_WEB_CANDIDATE_SCHEMA } from './openaiSearchSchema.js';

function createRequestBody(config, searchRequest) {
  return {
    model: config.model,
    input: createOpenAiWebInput(searchRequest, config.searchLimit),
    tools: [{ type: 'web_search' }],
    tool_choice: 'auto',
    store: config.storeResponses,
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

async function fetchOpenAiResponse(config, searchRequest) {
  return fetchJsonWithTimeout({
    providerName: OPENAI_WEB_PROVIDER_NAME,
    url: config.responsesUrl,
    fetchImpl: config.fetchImpl,
    timeoutMs: config.requestTimeoutMs,
    method: 'POST',
    unavailableMessage: 'OpenAI Responses API retornou resposta indisponivel.',
    timeoutMessage: 'Timeout ao consultar OpenAI Responses API.',
    failureMessage: 'Falha sanitizada ao consultar OpenAI Responses API.',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(createRequestBody(config, searchRequest))
  });
}

export function createOpenAiWebProvider(config = {}) {
  let normalizedConfig;

  function getConfig() {
    normalizedConfig ||= normalizeOpenAiWebConfig(config);
    return normalizedConfig;
  }

  return {
    name: OPENAI_WEB_PROVIDER_NAME,
    source: OPENAI_WEB_SOURCE,
    async search(searchRequest) {
      const currentConfig = getConfig();
      ensureOpenAiWebConfig(currentConfig);

      const payload = await fetchOpenAiResponse(currentConfig, searchRequest);
      return normalizeOpenAiWebCandidates({
        payload: parseOpenAiCandidatePayload(payload),
        searchRequest
      });
    }
  };
}
