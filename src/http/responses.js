import { toPublicError } from '../shared/errors.js';
import { sanitizePublicPayload } from '../shared/publicSanitizer.js';
import { securityHeaders } from './securityHeaders.js';

export function sendJson(response, statusCode, payload, options = {}) {
  if (response.writableEnded) {
    return;
  }

  response.writeHead(statusCode, securityHeaders({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': options.cacheControl || 'no-store',
    ...(options.headers || {})
  }));
  response.end(JSON.stringify(sanitizePublicPayload(payload)));
}

export function sendError(response, error, options = {}) {
  const publicError = toPublicError(error);
  return sendJson(response, publicError.statusCode, {
    error: {
      code: publicError.code,
      message: publicError.message,
      details: publicError.details
    }
  }, options);
}
