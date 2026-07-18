export function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function stripTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

export function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseDecimalMoney(amountValue, currencyValue) {
  const amount = Number.parseFloat(String(amountValue ?? ''));
  const currency = String(currencyValue || '').trim().toUpperCase();

  if (!Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) {
    return undefined;
  }

  return {
    amountCents: Math.round(amount * 100),
    currency
  };
}

export function parseMicrosMoney(price) {
  if (!price || typeof price !== 'object') {
    return undefined;
  }

  const micros = Number.parseInt(price.amountMicros || '', 10);
  const currency = String(price.currencyCode || '').trim().toUpperCase();

  if (!Number.isFinite(micros) || micros < 0 || !/^[A-Z]{3}$/.test(currency)) {
    return undefined;
  }

  return {
    amountCents: Math.round(micros / 10000),
    currency
  };
}

export function normalizeSearchText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function textMatchesQuery(text, normalizedQuery) {
  const haystack = normalizeSearchText(text);
  const terms = normalizeSearchText(normalizedQuery).split(' ').filter(Boolean);
  return terms.length > 0 && terms.every((term) => haystack.includes(term));
}

export function sameCurrency(...values) {
  const currencies = values.map((value) => value?.currency).filter(Boolean);
  return currencies.length === values.length && new Set(currencies).size === 1;
}
