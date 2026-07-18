import { fetchJsonWithTimeout } from './adapterHttp.js';
import {
  LOMADEE_PROVIDER_NAME,
  LOMADEE_SOURCE,
  ensureLomadeeConfig,
  lomadeeProductsUrl,
  normalizeLomadeeConfig
} from './lomadeeConfig.js';
import { normalizeLomadeeProductOffers } from './lomadeeOfferMapper.js';

async function fetchLomadeeJson(config, url) {
  return fetchJsonWithTimeout({
    providerName: LOMADEE_PROVIDER_NAME,
    url,
    fetchImpl: config.fetchImpl,
    timeoutMs: config.requestTimeoutMs,
    unavailableMessage: 'Lomadee API retornou resposta indisponivel.',
    timeoutMessage: 'Timeout ao consultar Lomadee API.',
    failureMessage: 'Falha sanitizada ao consultar Lomadee API.',
    headers: {
      'x-api-key': config.apiKey,
      Accept: 'application/json'
    }
  });
}

export function createLomadeeProvider(config = {}) {
  let normalizedConfig;

  function getConfig() {
    normalizedConfig ||= normalizeLomadeeConfig(config);
    return normalizedConfig;
  }

  return {
    name: LOMADEE_PROVIDER_NAME,
    source: LOMADEE_SOURCE,
    async search(searchRequest) {
      const currentConfig = getConfig();
      ensureLomadeeConfig(currentConfig);

      if (searchRequest.context.currency !== currentConfig.currency) {
        return [];
      }

      const payload = await fetchLomadeeJson(currentConfig, lomadeeProductsUrl(currentConfig, searchRequest));
      const products = Array.isArray(payload.data) ? payload.data : [];

      return products.flatMap((product) => normalizeLomadeeProductOffers({
        product,
        searchRequest,
        currency: currentConfig.currency
      }));
    }
  };
}
