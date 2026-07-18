import { ConfigurationError } from '../../../shared/errors.js';
import { isHttpsUrl, parsePositiveInteger } from './adapterUtils.js';

export const SHOPIFY_PROVIDER_NAME = 'shopify';
export const SHOPIFY_STOREFRONT_SOURCE = Object.freeze({
  type: 'api',
  name: 'Shopify Storefront API',
  url: 'https://shopify.dev/docs/api/storefront'
});

const DEFAULT_API_VERSION = '2026-07';
const DEFAULT_SEARCH_LIMIT = 5;
const DEFAULT_QUOTE_LIMIT = 3;
const DEFAULT_TIMEOUT_MS = 8000;

function clean(value) {
  return String(value || '').trim();
}

function normalizeStoreDomain(value) {
  const trimmed = clean(value);

  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    return parsed.hostname;
  } catch {
    return '';
  }
}

export function normalizeShopifyConfig(config = {}) {
  const storeDomain = normalizeStoreDomain(config.storeDomain);
  const apiVersion = clean(config.apiVersion || DEFAULT_API_VERSION);
  const endpoint = storeDomain ? `https://${storeDomain}/api/${apiVersion}/graphql.json` : '';

  if (endpoint && !isHttpsUrl(endpoint)) {
    throw new ConfigurationError('Endpoint do Shopify Storefront API invalido.', {
      providerName: SHOPIFY_PROVIDER_NAME,
      required: ['SHOPIFY_STORE_DOMAIN HTTPS']
    });
  }

  return {
    storeDomain,
    apiVersion,
    endpoint,
    accessToken: clean(config.accessToken),
    searchLimit: parsePositiveInteger(config.searchLimit, DEFAULT_SEARCH_LIMIT),
    quoteLimit: parsePositiveInteger(config.quoteLimit, DEFAULT_QUOTE_LIMIT),
    requestTimeoutMs: parsePositiveInteger(config.requestTimeoutMs, DEFAULT_TIMEOUT_MS),
    fetchImpl: config.fetchImpl || fetch
  };
}

export function ensureShopifyConfig(config) {
  const missing = [];

  if (!config.storeDomain) {
    missing.push('SHOPIFY_STORE_DOMAIN');
  }

  if (!config.accessToken) {
    missing.push('SHOPIFY_STOREFRONT_ACCESS_TOKEN');
  }

  if (missing.length > 0) {
    throw new ConfigurationError('Configuracao do Shopify Storefront API ausente.', {
      providerName: SHOPIFY_PROVIDER_NAME,
      required: missing
    });
  }
}
