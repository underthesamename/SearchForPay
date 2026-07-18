import { isHttpsUrl, sameCurrency, textMatchesQuery } from './adapterUtils.js';
import { OPENAI_WEB_PROVIDER_NAME, OPENAI_WEB_SOURCE } from './openaiSearchConfig.js';

const FINAL_CONFIDENCE = new Set(['high', 'medium']);

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanText(value, maxLength = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function hasEvidence(value) {
  return isPlainObject(value) && isHttpsUrl(value.evidenceUrl) && cleanText(value.evidenceText).length > 0;
}

function moneyFromEvidence(value, currency, { allowZero }) {
  if (!hasEvidence(value) || !Number.isInteger(value.amountCents) || value.amountCents < 0) {
    return undefined;
  }

  if (!allowZero && value.amountCents === 0) {
    return undefined;
  }

  return { amountCents: value.amountCents, currency };
}

function shippingFromCandidate(candidate, currency) {
  const shipping = candidate.shipping;

  if (!isPlainObject(shipping)) {
    return undefined;
  }

  if (shipping.exposed === false) {
    const warning = cleanText(shipping.warning || 'Frete nao exposto pela fonte web.');
    return { amountCents: 0, currency, exposed: false, warning };
  }

  return moneyFromEvidence(shipping, currency, { allowZero: true });
}

function deliveryFromCandidate(delivery) {
  if (!isPlainObject(delivery) || !Number.isInteger(delivery.maxDays) || delivery.maxDays < 0) {
    return undefined;
  }

  return {
    minDays: Number.isInteger(delivery.minDays) && delivery.minDays >= 0 ? delivery.minDays : undefined,
    maxDays: delivery.maxDays
  };
}

function evidenceList(candidate) {
  return [
    { field: 'price', url: candidate.price.evidenceUrl },
    candidate.shipping.exposed === false ? undefined : { field: 'shipping', url: candidate.shipping.evidenceUrl },
    { field: 'taxes', url: candidate.taxes.evidenceUrl }
  ].filter(Boolean);
}

function isUnavailable(value) {
  return /indisponivel|esgotado|sem estoque|unavailable|out of stock/.test(cleanText(value).toLowerCase());
}

function normalizeCandidate(candidate, searchRequest) {
  if (!isPlainObject(candidate) || candidate.rejected || !FINAL_CONFIDENCE.has(candidate.confidenceLevel)) {
    return undefined;
  }

  const currency = String(candidate.currency || '').trim().toUpperCase();

  if (
    currency !== searchRequest.context.currency ||
    isUnavailable(candidate.availability) ||
    !textMatchesQuery(candidate.title, searchRequest.normalizedQuery)
  ) {
    return undefined;
  }

  const price = moneyFromEvidence(candidate.price, currency, { allowZero: false });
  const shipping = shippingFromCandidate(candidate, currency);
  const taxes = moneyFromEvidence(candidate.taxes, currency, { allowZero: true });
  const productUrl = cleanText(candidate.productUrl, 500);
  const sellerName = cleanText(candidate.sellerName);

  if (!price || !shipping || !taxes || !sameCurrency(price, shipping, taxes) || !sellerName || !isHttpsUrl(productUrl)) {
    return undefined;
  }

  const offer = {
    providerName: OPENAI_WEB_PROVIDER_NAME,
    source: OPENAI_WEB_SOURCE,
    productTitle: cleanText(candidate.title),
    productUrl,
    price,
    shipping,
    taxes,
    seller: { name: sellerName },
    verification: {
      confidenceLevel: candidate.confidenceLevel,
      evidence: evidenceList(candidate),
      note: 'OpenAI web_search localizou candidatos; SearchForPay validou campos obrigatorios antes do ranking.'
    },
    warnings: ['Oferta localizada via web_search; confira o site antes de comprar.']
  };

  const delivery = deliveryFromCandidate(candidate.delivery);
  if (delivery) {
    offer.delivery = delivery;
  }

  if (shipping.exposed === false) {
    offer.warnings.push(shipping.warning);
  }

  return offer;
}

export function normalizeOpenAiWebCandidates({ payload, searchRequest }) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  const offers = candidates
    .map((candidate) => normalizeCandidate(candidate, searchRequest))
    .filter(Boolean);

  return {
    offers,
    report: {
      candidatesExtracted: candidates.length,
      candidatesRejected: candidates.length - offers.length,
      verificationLayer: 'web_search'
    }
  };
}
