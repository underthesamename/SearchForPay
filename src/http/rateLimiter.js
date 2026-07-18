function clientKey(request, trustProxyHeaders) {
  if (trustProxyHeaders) {
    const forwardedFor = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();

    if (forwardedFor) {
      return forwardedFor;
    }
  }

  return request.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter(options = {}) {
  const enabled = options.enabled !== false;
  const windowMs = options.windowMs || 60_000;
  const maxRequests = options.maxRequests || 60;
  const now = options.now || (() => Date.now());
  const buckets = new Map();

  function check(request) {
    if (!enabled) {
      return { allowed: true, remaining: maxRequests, resetAt: now() + windowMs };
    }

    const currentTime = now();
    const key = clientKey(request, options.trustProxyHeaders);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= currentTime) {
      buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
      return { allowed: true, remaining: maxRequests - 1, resetAt: currentTime + windowMs };
    }

    if (bucket.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))
      };
    }

    bucket.count += 1;
    return { allowed: true, remaining: maxRequests - bucket.count, resetAt: bucket.resetAt };
  }

  return { check };
}

export function rateLimitHeaders(result, limit) {
  const headers = {
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': String(Math.max(0, result.remaining)),
    'x-ratelimit-reset': new Date(result.resetAt).toISOString()
  };

  if (!result.allowed) {
    headers['retry-after'] = String(result.retryAfterSeconds);
  }

  return headers;
}
