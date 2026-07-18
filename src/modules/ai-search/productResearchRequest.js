import { ValidationError } from '../../shared/errors.js';
import {
  normalizeCurrencyCode,
  normalizePostalCode,
  validateProductQuery
} from '../../shared/validation.js';

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeCountry(value) {
  const country = String(value || 'BR').trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(country)) {
    throw new ValidationError('Informe um pais valido com 2 letras.');
  }

  return country;
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : [])
    .filter((item) => isHttpsUrl(item?.url))
    .slice(0, 5)
    .map((item) => ({
      url: item.url,
      title: String(item.title || item.url).replace(/\s+/g, ' ').trim().slice(0, 180),
      snippet: String(item.snippet || '').replace(/\s+/g, ' ').trim().slice(0, 260),
      accessedAt: item.accessedAt
    }));
}

function normalizeRevalidation(value) {
  if (!isPlainObject(value) || !isHttpsUrl(value.productUrl)) return undefined;

  return {
    productUrl: value.productUrl,
    evidence: normalizeEvidence(value.evidence),
    previous: isPlainObject(value.previous) ? value.previous : undefined
  };
}

export function normalizeResearchIntent(query) {
  return validateProductQuery(query)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function createProductResearchRequest(input = {}) {
  const context = isPlainObject(input.context) ? input.context : {};
  const query = validateProductQuery(input.query);
  const postalCode = normalizePostalCode(context.postalCode || context.cep || input.postalCode || input.cep);
  const revalidation = normalizeRevalidation(context.revalidation || input.revalidation);

  return {
    query,
    normalizedQuery: normalizeResearchIntent(query),
    context: {
      country: normalizeCountry(context.country || input.country),
      currency: normalizeCurrencyCode(context.currency || input.currency || 'BRL'),
      delivery: postalCode ? { postalCode } : undefined,
      ...(revalidation ? { revalidation } : {})
    }
  };
}
