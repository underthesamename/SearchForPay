import { ConfigurationError, ValidationError } from '../../shared/errors.js';
import {
  normalizeCurrencyCode,
  normalizePostalCode,
  validateProductQuery
} from '../../shared/validation.js';
import { validateOffer } from '../offers/offerValidation.js';

export const SEARCH_REQUEST_MODEL = Object.freeze({
  name: 'SearchRequest',
  version: 1,
  requiredFields: Object.freeze([
    'query',
    'normalizedQuery',
    'context.postalCode',
    'context.country',
    'context.currency'
  ])
});

export const SEARCH_RESULT_MODEL = Object.freeze({
  name: 'SearchResult',
  version: 1,
  requiredFields: Object.freeze(['query', 'normalizedQuery', 'context', 'results', 'meta'])
});

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeCountry(value) {
  const country = String(value || '').trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new ValidationError('Informe um pais valido com 2 letras.');
  }

  return country;
}

export function createSearchRequest(input = {}) {
  const context = isPlainObject(input.context) ? input.context : {};
  const query = validateProductQuery(input.query);
  const postalCode = normalizePostalCode(context.postalCode || context.cep || input.postalCode || input.cep);

  if (!postalCode) {
    throw new ValidationError('Informe um CEP para calcular frete e imposto.');
  }

  return {
    query,
    normalizedQuery: query.toLowerCase(),
    context: {
      postalCode,
      country: normalizeCountry(context.country || input.country || 'BR'),
      currency: normalizeCurrencyCode(context.currency || input.currency || 'BRL')
    }
  };
}

export function createSearchResult({ request, results, meta }) {
  if (!Array.isArray(results)) {
    throw new ConfigurationError('SearchResult exige results em array.');
  }

  for (const offer of results) {
    const validation = validateOffer(offer, {
      expectedCurrency: request.context.currency
    });

    if (!validation.valid) {
      throw new ConfigurationError('SearchResult recebeu oferta invalida.', {
        errors: validation.errors
      });
    }
  }

  return {
    query: request.query,
    normalizedQuery: request.normalizedQuery,
    context: request.context,
    results,
    meta: {
      ...meta,
      model: SEARCH_RESULT_MODEL.name,
      modelVersion: SEARCH_RESULT_MODEL.version
    }
  };
}
