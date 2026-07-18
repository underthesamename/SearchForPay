import { validatePublicId } from '../shared/validation.js';
import { rateLimitHeaders } from './rateLimiter.js';
import { sendJson } from './responses.js';

export function alertIdFromPath(pathname, suffix = '') {
  const escapedSuffix = suffix.replace('/', '\\/');
  const match = new RegExp(`^\\/api\\/alerts\\/([^/]+)${escapedSuffix}$`).exec(pathname);
  return match ? validatePublicId(decodeURIComponent(match[1])) : undefined;
}

export function shouldRateLimit(method, pathname) {
  return pathname.startsWith('/api/') && method !== 'OPTIONS';
}

export function enforceRateLimit({ request, response, rateLimiter, limit, logState }) {
  const rateLimit = rateLimiter.check(request);
  const headers = rateLimitHeaders(rateLimit, limit);

  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }

  if (rateLimit.allowed) {
    return false;
  }

  logState.rateLimited = true;
  sendJson(response, 429, {
    error: {
      code: 'RATE_LIMITED',
      message: 'Muitas requisicoes. Aguarde antes de tentar novamente.'
    }
  }, { headers });

  return true;
}
