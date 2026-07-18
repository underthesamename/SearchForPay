import { ServiceUnavailableError } from '../../shared/errors.js';

export const DEFAULT_MAX_CANDIDATES = 8;
export const DEFAULT_TIMEOUT_MS = 15000;
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 30;
export const MAX_CANDIDATES_LIMIT = 10;

export function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeMaxCandidates(value) {
  return Math.min(parsePositiveInteger(value, DEFAULT_MAX_CANDIDATES), MAX_CANDIDATES_LIMIT);
}

export function normalizeSearchLimits(config) {
  const timeoutMs = config.timeoutMs ?? config.requestTimeoutMs;

  return {
    maxCandidates: normalizeMaxCandidates(config.maxCandidates),
    timeoutMs: parsePositiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS),
    rateLimitWindowMs: parsePositiveInteger(
      config.rateLimitWindowMs,
      DEFAULT_RATE_LIMIT_WINDOW_MS
    ),
    rateLimitMaxRequests: parsePositiveInteger(
      config.rateLimitMaxRequests,
      DEFAULT_RATE_LIMIT_MAX_REQUESTS
    )
  };
}

export function createOpenAiSearchRateLimiter(config, now = () => Date.now()) {
  const timestamps = [];

  return {
    assertAllowed() {
      const currentTime = now();
      const cutoff = currentTime - config.rateLimitWindowMs;

      while (timestamps.length > 0 && timestamps[0] <= cutoff) {
        timestamps.shift();
      }

      if (timestamps.length >= config.rateLimitMaxRequests) {
        throw new ServiceUnavailableError('Rate limit local da pesquisa OpenAI atingido.', {
          providerName: config.providerName,
          rateLimitWindowMs: config.rateLimitWindowMs,
          rateLimitMaxRequests: config.rateLimitMaxRequests
        });
      }

      timestamps.push(currentTime);
    }
  };
}
