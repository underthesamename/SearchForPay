import { ServiceUnavailableError } from '../../../shared/errors.js';
import { fetchJsonWithTimeout } from './adapterHttp.js';
import {
  SHOPIFY_PROVIDER_NAME,
  SHOPIFY_STOREFRONT_SOURCE,
  ensureShopifyConfig,
  normalizeShopifyConfig
} from './shopifyStorefrontConfig.js';
import { cartInput, firstAvailableVariant, normalizeShopifyOffer } from './shopifyStorefrontMapper.js';
import { CART_MUTATION, PRODUCT_QUERY } from './shopifyStorefrontQueries.js';

async function graphql(config, query, variables) {
  const payload = await fetchJsonWithTimeout({
    providerName: SHOPIFY_PROVIDER_NAME,
    url: config.endpoint,
    fetchImpl: config.fetchImpl,
    timeoutMs: config.requestTimeoutMs,
    method: 'POST',
    unavailableMessage: 'Shopify Storefront API retornou resposta indisponivel.',
    timeoutMessage: 'Timeout ao consultar Shopify Storefront API.',
    failureMessage: 'Falha sanitizada ao consultar Shopify Storefront API.',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Shopify-Storefront-Access-Token': config.accessToken
    },
    body: JSON.stringify({ query, variables })
  });

  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new ServiceUnavailableError('Shopify Storefront API retornou erro GraphQL.', {
      providerName: SHOPIFY_PROVIDER_NAME
    });
  }

  return payload.data;
}

export function createShopifyStorefrontProvider(config = {}) {
  let normalizedConfig;

  function getConfig() {
    normalizedConfig ||= normalizeShopifyConfig(config);
    return normalizedConfig;
  }

  return {
    name: SHOPIFY_PROVIDER_NAME,
    source: SHOPIFY_STOREFRONT_SOURCE,
    async search(searchRequest) {
      const currentConfig = getConfig();
      ensureShopifyConfig(currentConfig);

      const data = await graphql(currentConfig, PRODUCT_QUERY, {
        first: currentConfig.searchLimit,
        query: searchRequest.normalizedQuery
      });
      const shopName = data?.shop?.name;
      const products = (data?.products?.edges || []).map((edge) => edge.node).filter(Boolean);
      const offers = [];

      for (const product of products.slice(0, currentConfig.quoteLimit)) {
        const variant = firstAvailableVariant(product, searchRequest.context.currency);

        if (!variant) {
          continue;
        }

        const quote = await graphql(currentConfig, CART_MUTATION, {
          input: cartInput(variant.id, searchRequest.context)
        });
        const cart = quote?.cartCreate?.cart;
        const offer = cart && normalizeShopifyOffer({ product, variant, cart, shopName, searchRequest });

        if (offer) {
          offers.push(offer);
        }
      }

      return offers;
    }
  };
}
