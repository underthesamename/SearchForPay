import { ConfigurationError } from '../../../shared/errors.js';
import { isHttpsUrl, parsePositiveInteger, stripTrailingSlash } from './adapterUtils.js';

export const GOOGLE_MERCHANT_PROVIDER_NAME = 'googlemerchant';
export const GOOGLE_MERCHANT_SOURCE = Object.freeze({
  type: 'api',
  name: 'Google Merchant API',
  url: 'https://developers.google.com/merchant/api'
});

const DEFAULT_PRODUCTS_BASE_URL = 'https://merchantapi.googleapis.com/products/v1beta';
const DEFAULT_ACCOUNTS_BASE_URL = 'https://merchantapi.googleapis.com/accounts/v1';
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_TIMEOUT_MS = 8000;

function clean(value) {
  return String(value || '').trim();
}

export function normalizeGoogleMerchantConfig(config = {}) {
  const productsBaseUrl = stripTrailingSlash(config.productsBaseUrl || DEFAULT_PRODUCTS_BASE_URL);
  const accountsBaseUrl = stripTrailingSlash(config.accountsBaseUrl || DEFAULT_ACCOUNTS_BASE_URL);

  if (!isHttpsUrl(productsBaseUrl) || !isHttpsUrl(accountsBaseUrl)) {
    throw new ConfigurationError('Endpoint do Google Merchant API invalido.', {
      providerName: GOOGLE_MERCHANT_PROVIDER_NAME,
      required: ['GOOGLE_MERCHANT_PRODUCTS_BASE_URL HTTPS', 'GOOGLE_MERCHANT_ACCOUNTS_BASE_URL HTTPS']
    });
  }

  return {
    accountId: clean(config.accountId),
    accessToken: clean(config.accessToken),
    productsBaseUrl,
    accountsBaseUrl,
    pageSize: parsePositiveInteger(config.pageSize, DEFAULT_PAGE_SIZE),
    requestTimeoutMs: parsePositiveInteger(config.requestTimeoutMs, DEFAULT_TIMEOUT_MS),
    fetchImpl: config.fetchImpl || fetch
  };
}

export function ensureGoogleMerchantConfig(config) {
  const missing = [];

  if (!config.accountId) {
    missing.push('GOOGLE_MERCHANT_ACCOUNT_ID');
  }

  if (!config.accessToken) {
    missing.push('GOOGLE_MERCHANT_ACCESS_TOKEN');
  }

  if (missing.length > 0) {
    throw new ConfigurationError('Configuracao do Google Merchant API ausente.', {
      providerName: GOOGLE_MERCHANT_PROVIDER_NAME,
      required: missing
    });
  }
}

export function googleMerchantAccountUrl(config) {
  return new URL(`${config.accountsBaseUrl}/accounts/${encodeURIComponent(config.accountId)}`);
}

export function googleMerchantProductsUrl(config) {
  const url = new URL(`${config.productsBaseUrl}/accounts/${encodeURIComponent(config.accountId)}/products`);
  url.searchParams.set('pageSize', String(config.pageSize));
  return url;
}
