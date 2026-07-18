const BASE_SECURITY_HEADERS = Object.freeze({
  'content-security-policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'"
  ].join('; '),
  'cross-origin-resource-policy': 'same-origin',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY'
});

export function securityHeaders(extraHeaders = {}) {
  return {
    ...BASE_SECURITY_HEADERS,
    ...extraHeaders
  };
}
