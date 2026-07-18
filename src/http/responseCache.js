import { createHash } from 'node:crypto';

function cacheDigest(parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

export function createSearchCacheKey({ url, defaultCountry, defaultCurrency }) {
  return cacheDigest({
    route: '/api/search',
    query: url.searchParams.get('query') || '',
    postalCode: url.searchParams.get('postalCode') || '',
    country: url.searchParams.get('country') || defaultCountry,
    currency: url.searchParams.get('currency') || defaultCurrency
  });
}

export function createResponseCache(options = {}) {
  const enabled = options.enabled !== false;
  const ttlMs = options.ttlMs || 30_000;
  const maxEntries = options.maxEntries || 100;
  const now = options.now || (() => Date.now());
  const entries = new Map();

  function get(key) {
    if (!enabled || ttlMs <= 0) {
      return undefined;
    }

    const entry = entries.get(key);

    if (!entry || entry.expiresAt <= now()) {
      entries.delete(key);
      return undefined;
    }

    return {
      payload: entry.payload,
      remainingMs: entry.expiresAt - now()
    };
  }

  function set(key, payload) {
    if (!enabled || ttlMs <= 0) {
      return;
    }

    entries.set(key, {
      payload,
      expiresAt: now() + ttlMs
    });

    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);
    }
  }

  return { get, set };
}
