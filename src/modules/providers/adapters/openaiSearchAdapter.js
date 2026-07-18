import { createOpenAiSearchClient } from '../../ai-search/openaiSearchClient.js';
import {
  OPENAI_WEB_PROVIDER_NAME,
  OPENAI_WEB_SOURCE,
  ensureOpenAiWebConfig,
  normalizeOpenAiWebConfig
} from './openaiSearchConfig.js';
import { normalizeOpenAiWebCandidates } from './openaiSearchMapper.js';

export function createOpenAiWebProvider(config = {}) {
  let normalizedConfig;
  let searchClient;

  function getConfig() {
    normalizedConfig ||= normalizeOpenAiWebConfig(config);
    return normalizedConfig;
  }

  function getSearchClient() {
    searchClient ||= createOpenAiSearchClient({
      ...getConfig(),
      providerName: OPENAI_WEB_PROVIDER_NAME
    });
    return searchClient;
  }

  return {
    name: OPENAI_WEB_PROVIDER_NAME,
    source: OPENAI_WEB_SOURCE,
    async search(searchRequest) {
      const currentConfig = getConfig();
      ensureOpenAiWebConfig(currentConfig);

      const payload = await getSearchClient().searchCandidates(searchRequest);
      return normalizeOpenAiWebCandidates({
        payload,
        searchRequest
      });
    }
  };
}
