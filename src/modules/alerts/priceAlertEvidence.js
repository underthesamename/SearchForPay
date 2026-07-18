import { createCostCompletenessFromWebCandidate } from '../search/searchContracts.js';
import { cleanText, isHttpsUrl, isPlainObject } from '../search/contractUtils.js';

export function money(value) {
  return isPlainObject(value) && Number.isInteger(value.amountCents) && value.currency
    ? { amountCents: value.amountCents, currency: value.currency } : null;
}

export function publicEvidence(value) {
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
      snippet: cleanText(item.snippet || 'Fonte revalidada.', 360),
      accessedAt: item.accessedAt || item.capturedAt || null
    }));
}

export function offerEvidence(offer) {
  return publicEvidence([
    ...(offer?.evidence || []),
    ...(offer?.verification?.evidence || []),
    ...(offer?.revalidation?.evidence || []),
    ...(offer?.revalidation?.currentCandidate?.evidence || [])
  ]);
}

export function totalCostFromCandidate(candidate) {
  const completeness = candidate?.costCompleteness || createCostCompletenessFromWebCandidate(candidate);
  const price = money(candidate?.visiblePrice || candidate?.price);
  const shipping = money(candidate?.shipping);
  const taxes = money(candidate?.taxes);

  if (completeness.complete !== true || !price || !shipping || !taxes) return null;
  if (new Set([price.currency, shipping.currency, taxes.currency]).size !== 1) return null;

  return {
    amountCents: price.amountCents + shipping.amountCents + taxes.amountCents,
    currency: price.currency,
    complete: true,
    missingComponents: [],
    warnings: []
  };
}
