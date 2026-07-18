import { ConfigurationError } from '../../../shared/errors.js';
import { isHttpsUrl, parsePositiveInteger, stripTrailingSlash } from './adapterUtils.js';

export const LOMADEE_PROVIDER_NAME = 'lomadee';
export const LOMADEE_SOURCE = Object.freeze({
  type: 'affiliate',
  name: 'Lomadee Affiliate Products API',
  url: 'https://docs.lomadee.com.br/api-reference/affiliate/products/all'
});

const DEFAULT_PRODUCTS_BASE_URL = 'https://api.lomadee.com.br/affiliate/products';
const DEFAULT_LIMIT = 10;
const DEFAULT_TIMEOUT_MS = 8000;

function clean(value) {
  return String(value || '').trim();
}

function normalizeCurrency(value) {
  const currency = clean(value || 'BRL').toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ConfigurationError('Moeda da Lomadee invalida.', {
      providerName: LOMADEE_PROVIDER_NAME,
      required: ['LOMADEE_CURRENCY ISO-4217']
    });
  }

  return currency;
}

function normalizeLimit(value) {
  return Math.min(parsePositiveInteger(value, DEFAULT_LIMIT), 100);
}

export function normalizeLomadeeConfig(config = {}) {
  const productsBaseUrl = stripTrailingSlash(config.productsBaseUrl || DEFAULT_PRODUCTS_BASE_URL);

  if (!isHttpsUrl(productsBaseUrl)) {
    throw new ConfigurationError('Endpoint da Lomadee API invalido.', {
      providerName: LOMADEE_PROVIDER_NAME,
      required: ['LOMADEE_PRODUCTS_BASE_URL HTTPS']
    });
  }

  return {
    apiKey: clean(config.apiKey),
    productsBaseUrl,
    organizationIds: clean(config.organizationIds),
    currency: normalizeCurrency(config.currency),
    searchLimit: normalizeLimit(config.searchLimit),
    requestTimeoutMs: parsePositiveInteger(config.requestTimeoutMs, DEFAULT_TIMEOUT_MS),
    fetchImpl: config.fetchImpl || fetch
  };
}

export function ensureLomadeeConfig(config) {
  if (!config.apiKey) {
    throw new ConfigurationError('Configuracao da Lomadee API ausente.', {
      providerName: LOMADEE_PROVIDER_NAME,
      required: ['LOMADEE_API_KEY']
    });
  }
}

export function lomadeeProductsUrl(config, searchRequest) {
  const url = new URL(config.productsBaseUrl);
  url.searchParams.set('page', '1');
  url.searchParams.set('limit', String(config.searchLimit));
  url.searchParams.set('isAvailable', 'true');
  url.searchParams.set('search', searchRequest.query);

  if (config.organizationIds) {
    url.searchParams.set('organizationIds', config.organizationIds);
  }

  return url;
}
