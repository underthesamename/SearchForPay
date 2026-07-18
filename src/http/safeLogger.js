import { redactSensitiveText } from '../shared/publicSanitizer.js';

function routeLabel(pathname) {
  if (/^\/api\/alerts\/[^/]+\/check$/.test(pathname)) {
    return '/api/alerts/:id/check';
  }

  if (/^\/api\/alerts\/[^/]+$/.test(pathname)) {
    return '/api/alerts/:id';
  }

  return pathname || '/';
}

export function createSafeLogger(options = {}) {
  const enabled = options.enabled !== false;
  const sink = options.sink || console;

  function request(event) {
    if (!enabled) {
      return;
    }

    sink.info?.({
      event: 'http_request',
      method: event.method,
      route: redactSensitiveText(routeLabel(event.pathname)),
      statusCode: event.statusCode,
      durationMs: event.durationMs,
      cache: event.cache,
      rateLimited: Boolean(event.rateLimited)
    });
  }

  function startup(event) {
    if (enabled) {
      sink.info?.({ event: 'startup', service: 'SearchForPay', port: event.port });
    }
  }

  return { request, startup };
}
