function cleanText(value, maxLength = 260) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function money(value) {
  return value && Number.isInteger(value.amountCents) && value.currency
    ? { amountCents: value.amountCents, currency: value.currency } : null;
}

function cost(value) {
  if (!value || value.exposed === false) {
    return {
      exposed: false,
      amountCents: null,
      currency: null,
      warning: cleanText(value?.warning) || undefined
    };
  }

  const parsed = money(value);
  return parsed ? { exposed: true, ...parsed } : { exposed: false, amountCents: null, currency: null };
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
      snippet: cleanText(item.snippet || 'Fonte consultada.', 360),
      accessedAt: item.accessedAt || item.capturedAt || null
    }));
}

export function alertCandidatePayload(source = {}) {
  return {
    productTitle: cleanText(source.productTitle || source.title || source.productUrl),
    storeName: cleanText(source.storeName || source.seller?.name || ''),
    productUrl: cleanText(source.productUrl, 500),
    visiblePrice: money(source.visiblePrice || source.price),
    shipping: cost(source.shipping),
    taxes: cost(source.taxes),
    availability: cleanText(source.availability || 'precisa confirmacao'),
    evidence: evidenceList(source.evidence || source.verification?.evidence),
    confidence: cleanText(source.confidence || source.verification?.confidenceLevel || 'medium'),
    warnings: Array.isArray(source.warnings) ? source.warnings.map((item) => cleanText(item)).filter(Boolean) : [],
    delivery: source.delivery || null
  };
}

export function encodeAlertCandidate(source) {
  return JSON.stringify(alertCandidatePayload(source));
}

export function decodeAlertCandidate(value) {
  try {
    return alertCandidatePayload(JSON.parse(value));
  } catch {
    return null;
  }
}
