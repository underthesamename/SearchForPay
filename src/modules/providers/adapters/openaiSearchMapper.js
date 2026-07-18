import { sameCurrency, textMatchesQuery } from './adapterUtils.js';
import { OPENAI_WEB_PROVIDER_NAME, OPENAI_WEB_SOURCE } from './openaiSearchConfig.js';
import {
  canPromoteWebCandidateToOffer,
  validateWebOfferCandidate
} from '../webOfferCandidateModel.js';

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cleanText(value, maxLength = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function moneyFromCandidate(value) {
  return {
    amountCents: value.amountCents,
    currency: value.currency
  };
}

function shippingFromCandidate(candidate) {
  if (candidate.shipping.exposed === false) {
    const warning = cleanText(candidate.shipping.warning || 'Frete nao exposto pela fonte web.');
    return {
      amountCents: 0,
      currency: candidate.visiblePrice.currency,
      exposed: false,
      warning
    };
  }

  return moneyFromCandidate(candidate.shipping);
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
  return candidate.evidence.map((item) => ({
    field: 'web',
    url: item.url,
    title: cleanText(item.title),
    accessedAt: item.accessedAt
  }));
}

function warningsList(candidate, shipping) {
  return [
    'Oferta localizada via web_search; confira o site antes de comprar.',
    ...candidate.warnings.map((warning) => cleanText(warning)).filter(Boolean),
    shipping.exposed === false ? shipping.warning : undefined
  ].filter((value, index, list) => value && list.indexOf(value) === index);
}

function isUnavailable(value) {
  return /indisponivel|esgotado|sem estoque|unavailable|out of stock/.test(cleanText(value).toLowerCase());
}

function normalizeCandidate(candidate, searchRequest) {
  const validation = validateWebOfferCandidate(candidate);

  if (!validation.valid || !canPromoteWebCandidateToOffer(candidate)) {
    return undefined;
  }

  const currency = candidate.visiblePrice.currency;

  if (
    currency !== searchRequest.context.currency ||
    isUnavailable(candidate.availability) ||
    !textMatchesQuery(candidate.productTitle, searchRequest.normalizedQuery)
  ) {
    return undefined;
  }

  const price = moneyFromCandidate(candidate.visiblePrice);
  const shipping = shippingFromCandidate(candidate);
  const taxes = moneyFromCandidate(candidate.taxes);
  const sellerName = cleanText(candidate.storeName);
  const productTitle = cleanText(candidate.productTitle);

  if (!sellerName || !productTitle || !sameCurrency(price, shipping, taxes)) {
    return undefined;
  }

  const offer = {
    providerName: OPENAI_WEB_PROVIDER_NAME,
    source: OPENAI_WEB_SOURCE,
    productTitle,
    productUrl: cleanText(candidate.productUrl, 500),
    price,
    shipping,
    taxes,
    seller: { name: sellerName },
    verification: {
      confidenceLevel: candidate.confidence,
      evidence: evidenceList(candidate),
      note: 'OpenAI web_search localizou candidatos; SearchForPay validou campos obrigatorios antes do ranking.'
    },
    warnings: warningsList(candidate, shipping)
  };

  const delivery = deliveryFromCandidate(candidate.delivery);
  if (delivery) {
    offer.delivery = delivery;
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
