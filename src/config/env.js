import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(value, fallback) {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (!normalized) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function parseProviderList(value) {
  return String(value || '')
    .split(',')
    .map((provider) => provider.trim())
    .filter(Boolean);
}

function parseDotEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return undefined;
  }

  const separatorIndex = trimmed.indexOf('=');

  if (separatorIndex === -1) {
    return undefined;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const value = rawValue.replace(/^['"]|['"]$/g, '');

  return key ? [key, value] : undefined;
}

function readDotEnv(envFilePath) {
  if (!envFilePath || !existsSync(envFilePath)) {
    return {};
  }

  const entries = readFileSync(envFilePath, 'utf8')
    .split(/\r?\n/)
    .map(parseDotEnvLine)
    .filter(Boolean);

  return Object.fromEntries(entries);
}

function cleanString(value) {
  return String(value || '').trim();
}

function getEbayConfig(source, requestTimeoutMs) {
  return {
    environment: cleanString(source.EBAY_ENVIRONMENT || 'production'),
    marketplaceId: cleanString(source.EBAY_MARKETPLACE_ID || 'EBAY_US'),
    clientId: cleanString(source.EBAY_CLIENT_ID),
    clientSecret: cleanString(source.EBAY_CLIENT_SECRET),
    accessToken: cleanString(source.EBAY_BROWSE_ACCESS_TOKEN || source.EBAY_ACCESS_TOKEN),
    browseBaseUrl: cleanString(source.EBAY_BROWSE_BASE_URL),
    oauthBaseUrl: cleanString(source.EBAY_OAUTH_BASE_URL),
    scope: cleanString(source.EBAY_SCOPE || 'https://api.ebay.com/oauth/api_scope'),
    searchLimit: parseInteger(source.EBAY_SEARCH_LIMIT, 10),
    requestTimeoutMs: parseInteger(source.EBAY_REQUEST_TIMEOUT_MS, requestTimeoutMs)
  };
}

function getShopifyConfig(source, requestTimeoutMs) {
  return {
    storeDomain: cleanString(source.SHOPIFY_STORE_DOMAIN),
    accessToken: cleanString(source.SHOPIFY_STOREFRONT_ACCESS_TOKEN),
    apiVersion: cleanString(source.SHOPIFY_API_VERSION || '2026-07'),
    searchLimit: parseInteger(source.SHOPIFY_SEARCH_LIMIT, 5),
    quoteLimit: parseInteger(source.SHOPIFY_QUOTE_LIMIT, 3),
    requestTimeoutMs: parseInteger(source.SHOPIFY_REQUEST_TIMEOUT_MS, requestTimeoutMs)
  };
}

function getGoogleMerchantConfig(source, requestTimeoutMs) {
  return {
    accountId: cleanString(source.GOOGLE_MERCHANT_ACCOUNT_ID),
    accessToken: cleanString(source.GOOGLE_MERCHANT_ACCESS_TOKEN),
    productsBaseUrl: cleanString(source.GOOGLE_MERCHANT_PRODUCTS_BASE_URL),
    accountsBaseUrl: cleanString(source.GOOGLE_MERCHANT_ACCOUNTS_BASE_URL),
    pageSize: parseInteger(source.GOOGLE_MERCHANT_PAGE_SIZE, 25),
    requestTimeoutMs: parseInteger(source.GOOGLE_MERCHANT_REQUEST_TIMEOUT_MS, requestTimeoutMs)
  };
}

function getLomadeeConfig(source, requestTimeoutMs) {
  return {
    apiKey: cleanString(source.LOMADEE_API_KEY),
    productsBaseUrl: cleanString(source.LOMADEE_PRODUCTS_BASE_URL),
    organizationIds: cleanString(source.LOMADEE_ORGANIZATION_IDS),
    currency: cleanString(source.LOMADEE_CURRENCY || source.DEFAULT_CURRENCY || 'BRL'),
    searchLimit: parseInteger(source.LOMADEE_SEARCH_LIMIT, 10),
    requestTimeoutMs: parseInteger(source.LOMADEE_REQUEST_TIMEOUT_MS, requestTimeoutMs)
  };
}

function getOpenAiWebConfig(source, requestTimeoutMs) {
  return {
    apiKey: cleanString(source.OPENAI_API_KEY),
    responsesUrl: cleanString(source.OPENAI_RESPONSES_URL),
    model: cleanString(source.OPENAI_SEARCH_MODEL || 'gpt-5.6'),
    searchLimit: parseInteger(source.OPENAI_SEARCH_LIMIT, 6),
    requestTimeoutMs: parseInteger(source.OPENAI_REQUEST_TIMEOUT_MS, requestTimeoutMs),
    storeResponses: cleanString(source.OPENAI_STORE_RESPONSES || 'false')
  };
}

export function getEnv(source = process.env, options = {}) {
  const dotEnv = options.loadDotEnv === false ? {} : readDotEnv(options.envFilePath || resolve(process.cwd(), '.env'));
  const mergedSource = {
    ...dotEnv,
    ...source
  };
  const requestTimeoutMs = parseInteger(mergedSource.REQUEST_TIMEOUT_MS, 8000);

  return {
    port: parseInteger(mergedSource.PORT, 3000),
    defaultCountry: mergedSource.DEFAULT_COUNTRY || 'BR',
    defaultCurrency: mergedSource.DEFAULT_CURRENCY || 'BRL',
    requestTimeoutMs,
    maxResults: parseInteger(mergedSource.MAX_RESULTS, 3),
    requestBodyLimitBytes: parseInteger(mergedSource.REQUEST_BODY_LIMIT_BYTES, 16_384),
    requestLoggingEnabled: parseBoolean(mergedSource.REQUEST_LOGGING_ENABLED, true),
    rateLimitEnabled: parseBoolean(mergedSource.RATE_LIMIT_ENABLED, true),
    rateLimitWindowMs: parseInteger(mergedSource.RATE_LIMIT_WINDOW_MS, 60 * 1000),
    rateLimitMaxRequests: parseInteger(mergedSource.RATE_LIMIT_MAX_REQUESTS, 60),
    trustProxyHeaders: parseBoolean(mergedSource.TRUST_PROXY_HEADERS, false),
    searchCacheEnabled: parseBoolean(mergedSource.SEARCH_CACHE_ENABLED, true),
    searchCacheTtlMs: parseInteger(mergedSource.SEARCH_CACHE_TTL_MS, 30 * 1000),
    searchCacheMaxEntries: parseInteger(mergedSource.SEARCH_CACHE_MAX_ENTRIES, 100),
    serverRequestTimeoutMs: parseInteger(mergedSource.SERVER_REQUEST_TIMEOUT_MS, 30 * 1000),
    serverHeadersTimeoutMs: parseInteger(mergedSource.SERVER_HEADERS_TIMEOUT_MS, 35 * 1000),
    serverKeepAliveTimeoutMs: parseInteger(mergedSource.SERVER_KEEP_ALIVE_TIMEOUT_MS, 5 * 1000),
    priceAlertsEnabled: parseBoolean(mergedSource.PRICE_ALERTS_ENABLED, true),
    priceAlertsFile: cleanString(mergedSource.PRICE_ALERTS_FILE || '.searchforpay/price-alerts.json'),
    priceAlertJobIntervalMs: parseInteger(mergedSource.PRICE_ALERT_JOB_INTERVAL_MS, 5 * 60 * 1000),
    priceAlertRecheckIntervalMs: parseInteger(mergedSource.PRICE_ALERT_RECHECK_INTERVAL_MS, 60 * 60 * 1000),
    marketplaceProviders: parseProviderList(mergedSource.MARKETPLACE_PROVIDERS),
    providerOptions: {
      ebay: getEbayConfig(mergedSource, requestTimeoutMs),
      googlemerchant: getGoogleMerchantConfig(mergedSource, requestTimeoutMs),
      lomadee: getLomadeeConfig(mergedSource, requestTimeoutMs),
      openaiweb: getOpenAiWebConfig(mergedSource, requestTimeoutMs),
      shopify: getShopifyConfig(mergedSource, requestTimeoutMs)
    }
  };
}
