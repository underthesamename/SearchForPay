import { ValidationError } from '../../shared/errors.js';
import { cleanText, isHttpsUrl, isPlainObject } from '../search/contractUtils.js';

function money(value) {
  if (!isPlainObject(value) || !Number.isInteger(value.amountCents)) return null;
  const currency = cleanText(value.currency).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { amountCents: value.amountCents, currency };
}

function cost(value) {
  if (!isPlainObject(value) || value.exposed === false) {
    return {
      exposed: false,
      amountCents: null,
      currency: null,
      warning: cleanText(value?.warning) || undefined
    };
  }

  const parsed = money(value);
  return parsed
    ? { exposed: true, ...parsed, warning: cleanText(value.warning) || undefined }
    : { exposed: false, amountCents: null, currency: null, warning: cleanText(value.warning) || undefined };
}

function evidenceList(value) {
  const seen = new Set();

  return (Array.isArray(value) ? value : [])
    .filter((item) => {
      if (!isHttpsUrl(item?.url) || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .slice(0, 5)
    .map((item) => ({
      url: item.url,
      title: cleanText(item.title || item.url),
      snippet: cleanText(item.snippet || 'Evidencia salva do candidato.', 360),
      accessedAt: item.accessedAt || item.capturedAt || null
    }));
}

export function normalizeAlertCandidateTarget(input = {}) {
  const source = input.candidateTarget || input.candidate;

  if (!isPlainObject(source)) {
    if (input.sourceType === 'candidate') {
      throw new ValidationError('Alerta por candidato exige candidato verificavel.');
    }
    return null;
  }

  const productUrl = cleanText(source.productUrl, 500);
  const evidence = evidenceList(source.evidence || source.verification?.evidence);

  if (!isHttpsUrl(productUrl) || evidence.length === 0) {
    throw new ValidationError('Alerta por candidato exige productUrl HTTPS e evidencia HTTPS.');
  }

  return {
    productTitle: cleanText(source.productTitle || productUrl),
    storeName: cleanText(source.storeName || source.seller?.name || ''),
    productUrl,
    visiblePrice: money(source.visiblePrice || source.price),
    shipping: cost(source.shipping),
    taxes: cost(source.taxes),
    availability: cleanText(source.availability || 'precisa confirmacao'),
    evidence,
    confidence: cleanText(source.confidence || source.verification?.confidenceLevel || 'medium'),
    warnings: Array.isArray(source.warnings) ? source.warnings.map((item) => cleanText(item)).filter(Boolean) : [],
    delivery: isPlainObject(source.delivery) ? source.delivery : null
  };
}
