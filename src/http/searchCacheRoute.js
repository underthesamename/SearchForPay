import { createSearchPayload } from '../modules/search/searchController.js';
import { createSearchCacheKey } from './responseCache.js';
import { sendJson } from './responses.js';

export async function handleCachedSearchRequest({
  url,
  response,
  searchService,
  searchCache,
  defaultCountry,
  defaultCurrency,
  logState
}) {
  const cacheKey = createSearchCacheKey({ url, defaultCountry, defaultCurrency });
  const cached = searchCache.get(cacheKey);

  if (cached) {
    logState.cache = 'HIT';
    return sendJson(response, 200, cached.payload, {
      headers: {
        'x-cache': 'HIT',
        'x-cache-ttl-ms': String(cached.remainingMs)
      }
    });
  }

  logState.cache = 'MISS';
  const payload = await createSearchPayload({
    url,
    searchService,
    defaultCountry,
    defaultCurrency
  });
  searchCache.set(cacheKey, payload);

  return sendJson(response, 200, payload, {
    headers: { 'x-cache': 'MISS' }
  });
}
