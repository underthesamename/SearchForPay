import { fetchJsonWithTimeout } from './adapterHttp.js';
import {
  GOOGLE_MERCHANT_PROVIDER_NAME,
  GOOGLE_MERCHANT_SOURCE,
  ensureGoogleMerchantConfig,
  googleMerchantAccountUrl,
  googleMerchantProductsUrl,
  normalizeGoogleMerchantConfig
} from './googleMerchantConfig.js';
import { normalizeGoogleMerchantOffer } from './googleMerchantOfferMapper.js';

async function fetchGoogleJson(config, url) {
  return fetchJsonWithTimeout({
    providerName: GOOGLE_MERCHANT_PROVIDER_NAME,
    url,
    fetchImpl: config.fetchImpl,
    timeoutMs: config.requestTimeoutMs,
    unavailableMessage: 'Google Merchant API retornou resposta indisponivel.',
    timeoutMessage: 'Timeout ao consultar Google Merchant API.',
    failureMessage: 'Falha sanitizada ao consultar Google Merchant API.',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      Accept: 'application/json'
    }
  });
}

export function createGoogleMerchantProvider(config = {}) {
  let normalizedConfig;

  function getConfig() {
    normalizedConfig ||= normalizeGoogleMerchantConfig(config);
    return normalizedConfig;
  }

  return {
    name: GOOGLE_MERCHANT_PROVIDER_NAME,
    source: GOOGLE_MERCHANT_SOURCE,
    async search(searchRequest) {
      const currentConfig = getConfig();
      ensureGoogleMerchantConfig(currentConfig);

      const account = await fetchGoogleJson(currentConfig, googleMerchantAccountUrl(currentConfig));
      const payload = await fetchGoogleJson(currentConfig, googleMerchantProductsUrl(currentConfig));
      const products = Array.isArray(payload.products) ? payload.products : [];

      return products
        .map((product) => normalizeGoogleMerchantOffer({ product, account, searchRequest }))
        .filter(Boolean);
    }
  };
}
