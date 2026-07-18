const HISTORY_KEY = 'searchforpay.history.v1';
const PREFERENCES_KEY = 'searchforpay.preferences.v1';
const MAX_HISTORY_ITEMS = 6;
const SUPPORTED_COUNTRIES = new Set([
  'BR', 'US', 'CA', 'MX', 'AR', 'CL', 'CO', 'PT',
  'ES', 'FR', 'DE', 'IT', 'NL', 'GB', 'AU', 'JP'
]);
const SUPPORTED_CURRENCIES = new Set([
  'BRL', 'USD', 'EUR', 'GBP', 'CAD', 'MXN',
  'ARS', 'CLP', 'COP', 'AUD', 'JPY'
]);
const SUPPORTED_COMPARISON_CRITERIA = new Set([
  'custo_total_confirmado',
  'mais_confiavel',
  'menor_prazo'
]);

function cleanComparisonCriteria(value) {
  const criteria = String(value || 'custo_total_confirmado').trim();
  return SUPPORTED_COMPARISON_CRITERIA.has(criteria) ? criteria : 'custo_total_confirmado';
}

function safeRead(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWrite(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function cleanSearch(input = {}) {
  const query = String(input.query || '').trim();
  const postalCode = String(input.postalCode || '').trim();
  const country = String(input.country || '').trim().toUpperCase();
  const currency = String(input.currency || '').trim().toUpperCase();
  const comparisonCriteria = cleanComparisonCriteria(input.comparisonCriteria);

  if (!query || !postalCode || !SUPPORTED_COUNTRIES.has(country) || !SUPPORTED_CURRENCIES.has(currency)) {
    return undefined;
  }

  return { query, postalCode, country, currency, comparisonCriteria };
}

function cleanPreferences(input = {}) {
  const postalCode = String(input.postalCode || '').trim();
  const country = String(input.country || '').trim().toUpperCase();
  const currency = String(input.currency || '').trim().toUpperCase();
  const comparisonCriteria = cleanComparisonCriteria(input.comparisonCriteria);

  if (!postalCode || !SUPPORTED_COUNTRIES.has(country) || !SUPPORTED_CURRENCIES.has(currency)) {
    return undefined;
  }

  return { postalCode, country, currency, comparisonCriteria };
}

function sameSearch(left, right) {
  return (
    left.query.toLowerCase() === right.query.toLowerCase() &&
    left.postalCode === right.postalCode &&
    left.country === right.country &&
    left.currency === right.currency &&
    left.comparisonCriteria === right.comparisonCriteria
  );
}

function createId(search) {
  return [
    search.query.toLowerCase(),
    search.postalCode,
    search.country,
    search.currency,
    search.comparisonCriteria
  ].join('|');
}

export function maskPostalCode(postalCode) {
  const normalized = String(postalCode || '').replace(/\s+/g, '');
  return normalized.length > 3 ? `CEP final ${normalized.slice(-3)}` : 'CEP salvo';
}

export function createSearchMemory(storage = defaultStorage()) {
  function loadHistory() {
    return safeRead(storage, HISTORY_KEY, [])
      .map(cleanSearch)
      .filter(Boolean)
      .slice(0, MAX_HISTORY_ITEMS);
  }

  function loadPreferences() {
    return cleanPreferences(safeRead(storage, PREFERENCES_KEY, {}));
  }

  function saveSearch(input) {
    const search = cleanSearch(input);

    if (!search) {
      return loadHistory();
    }

    const entry = { ...search, id: createId(search), searchedAt: new Date().toISOString() };
    const history = [entry, ...loadHistory().filter((item) => !sameSearch(item, search))]
      .slice(0, MAX_HISTORY_ITEMS);

    safeWrite(storage, HISTORY_KEY, history);
    safeWrite(storage, PREFERENCES_KEY, {
      postalCode: search.postalCode,
      country: search.country,
      currency: search.currency,
      comparisonCriteria: search.comparisonCriteria,
      updatedAt: entry.searchedAt
    });

    return history;
  }

  function clearHistory() {
    safeWrite(storage, HISTORY_KEY, []);
    return [];
  }

  return {
    loadHistory,
    loadPreferences,
    saveSearch,
    clearHistory
  };
}
