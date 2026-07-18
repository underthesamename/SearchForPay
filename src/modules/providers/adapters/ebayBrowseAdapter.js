import {
  EBAY_BROWSE_SOURCE,
  EBAY_PROVIDER_NAME,
  createEbayHeaders,
  createEbayItemUrl,
  createEbaySearchUrl,
  ensureEbayCredentials,
  normalizeEbayConfig
} from './ebayBrowseConfig.js';
import { fetchEbayJson, getEbayAccessToken } from './ebayBrowseHttp.js';
import { normalizeEbayOffer } from './ebayBrowseOfferMapper.js';

function mergeItemSummaryAndDetail(summary, detail) {
  return {
    itemId: detail.itemId || summary.itemId,
    title: detail.title || summary.title,
    itemWebUrl: detail.itemWebUrl || summary.itemWebUrl,
    itemAffiliateWebUrl: detail.itemAffiliateWebUrl || summary.itemAffiliateWebUrl,
    price: detail.price || summary.price,
    seller: detail.seller || summary.seller,
    taxes: detail.taxes,
    shippingOptions: detail.shippingOptions || summary.shippingOptions
  };
}

export function createEbayBrowseProvider(config = {}) {
  let normalizedConfig;
  const tokenCacheRef = { value: undefined };

  function getConfig() {
    if (!normalizedConfig) {
      normalizedConfig = normalizeEbayConfig(config);
    }

    return normalizedConfig;
  }

  return {
    name: EBAY_PROVIDER_NAME,
    source: EBAY_BROWSE_SOURCE,
    async search(searchRequest) {
      const currentConfig = getConfig();

      ensureEbayCredentials(currentConfig);

      const accessToken = await getEbayAccessToken(currentConfig, tokenCacheRef);
      const headers = createEbayHeaders(currentConfig, accessToken, searchRequest.context);
      const searchPayload = await fetchEbayJson(createEbaySearchUrl(currentConfig, searchRequest), {
        timeoutMs: currentConfig.requestTimeoutMs,
        fetchImpl: currentConfig.fetchImpl,
        headers
      });
      const summaries = Array.isArray(searchPayload.itemSummaries) ? searchPayload.itemSummaries : [];
      const offers = [];

      for (const summary of summaries) {
        if (!summary?.itemId) {
          continue;
        }

        const detail = await fetchEbayJson(createEbayItemUrl(currentConfig, summary.itemId), {
          timeoutMs: currentConfig.requestTimeoutMs,
          fetchImpl: currentConfig.fetchImpl,
          headers
        });
        const offer = normalizeEbayOffer(mergeItemSummaryAndDetail(summary, detail), searchRequest);

        if (offer) {
          offers.push(offer);
        }
      }

      return offers;
    }
  };
}
