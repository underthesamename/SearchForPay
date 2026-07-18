import { ConfigurationError } from '../../../shared/errors.js';

export const EBAY_PROVIDER_NAME = 'ebay';
export const EBAY_BROWSE_SOURCE = Object.freeze({
  type: 'api',
  name: 'eBay Browse API',
  url: 'https://www.developer.ebay.com/api-docs/buy/static/api-browse.html'
});

const DEFAULT_SCOPE = 'https://api.ebay.com/oauth/api_scope';
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_TIMEOUT_MS = 8000;

function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getEnvironmentBaseUrls(environment) {
  if (environment === 'sandbox') {
    return {
      browseBaseUrl: 'https://api.sandbox.ebay.com/buy/browse/v1',
      oauthBaseUrl: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token'
    };
  }

  return {
    browseBaseUrl: 'https://api.ebay.com/buy/browse/v1',
    oauthBaseUrl: 'https://api.ebay.com/identity/v1/oauth2/token'
  };
}

export function normalizeEbayConfig(config = {}) {
  const environment = config.environment === 'sandbox' ? 'sandbox' : 'production';
  const defaults = getEnvironmentBaseUrls(environment);
  const browseBaseUrl = stripTrailingSlash(config.browseBaseUrl || defaults.browseBaseUrl);
  const oauthBaseUrl = String(config.oauthBaseUrl || defaults.oauthBaseUrl).trim();

  if (!isHttpsUrl(browseBaseUrl) || !isHttpsUrl(oauthBaseUrl)) {
    throw new ConfigurationError('Endpoint do eBay Browse API invalido.', {
      providerName: EBAY_PROVIDER_NAME,
      required: ['EBAY_BROWSE_BASE_URL HTTPS', 'EBAY_OAUTH_BASE_URL HTTPS']
    });
  }

  return {
    environment,
    browseBaseUrl,
    oauthBaseUrl,
    marketplaceId: String(config.marketplaceId || 'EBAY_US').trim(),
    clientId: String(config.clientId || '').trim(),
    clientSecret: String(config.clientSecret || '').trim(),
    accessToken: String(config.accessToken || '').trim(),
    scope: String(config.scope || DEFAULT_SCOPE).trim(),
    searchLimit: parseInteger(config.searchLimit, DEFAULT_SEARCH_LIMIT),
    requestTimeoutMs: parseInteger(config.requestTimeoutMs, DEFAULT_TIMEOUT_MS),
    fetchImpl: config.fetchImpl || fetch
  };
}

export function ensureEbayCredentials(config) {
  if (config.accessToken || (config.clientId && config.clientSecret)) {
    return;
  }

  throw new ConfigurationError('Credenciais do eBay Browse API ausentes.', {
    providerName: EBAY_PROVIDER_NAME,
    required: ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET'],
    alternative: 'EBAY_BROWSE_ACCESS_TOKEN'
  });
}

export function createEbayHeaders(config, accessToken, context) {
  const location = `country=${context.country},zip=${context.postalCode}`;

  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'X-EBAY-C-MARKETPLACE-ID': config.marketplaceId,
    'X-EBAY-C-ENDUSERCTX': `contextualLocation=${encodeURIComponent(location)}`
  };
}

export function createEbaySearchUrl(config, searchRequest) {
  const url = new URL(`${config.browseBaseUrl}/item_summary/search`);
  url.searchParams.set('q', searchRequest.normalizedQuery || searchRequest.query);
  url.searchParams.set('limit', String(config.searchLimit));
  url.searchParams.set('filter', `buyingOptions:{FIXED_PRICE},deliveryCountry:${searchRequest.context.country}`);
  return url;
}

export function createEbayItemUrl(config, itemId) {
  return new URL(`${config.browseBaseUrl}/item/${encodeURIComponent(itemId)}`);
}
