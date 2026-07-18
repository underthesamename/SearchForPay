import { URL } from 'node:url';
import { getEnv } from '../config/env.js';
import {
  handleCheckAlertRequest,
  handleCreateAlertRequest,
  handleDeleteAlertRequest,
  handleListAlertsRequest
} from '../modules/alerts/priceAlertController.js';
import { startPriceAlertJob } from '../modules/alerts/priceAlertJob.js';
import { createPriceAlertService } from '../modules/alerts/priceAlertService.js';
import { createPriceAlertStore } from '../modules/alerts/priceAlertStore.js';
import { createCandidateRevalidationService } from '../modules/ai-search/candidateRevalidationService.js';
import { createProductResearchService } from '../modules/ai-search/productResearchService.js';
import { createProviderRegistry } from '../modules/providers/providerRegistry.js';
import { handleCandidateRevalidationRequest } from '../modules/search/candidateRevalidationController.js';
import { createSearchService } from '../modules/search/searchService.js';
import { createRateLimiter } from './rateLimiter.js';
import { createResponseCache } from './responseCache.js';
import { createHealthPayload } from './healthPayload.js';
import { alertIdFromPath, enforceRateLimit, shouldRateLimit } from './routeGuards.js';
import { createSafeLogger } from './safeLogger.js';
import { handleCachedSearchRequest } from './searchCacheRoute.js';
import { sendError, sendJson } from './responses.js';
import { serveStaticFile } from './staticFiles.js';

export function createApp(options = {}) {
  const env = options.env || getEnv(process.env);
  const publicDir = options.publicDir || new URL('../../public/', import.meta.url);
  const providerRegistry = options.providerRegistry || createProviderRegistry({
    providerNames: env.marketplaceProviders,
    providerOptions: env.providerOptions
  });
  const productResearchService = options.productResearchService || createProductResearchService({
    openAiConfig: env.providerOptions.openaiweb
  });
  const candidateRevalidationService = options.candidateRevalidationService || createCandidateRevalidationService({
    productResearchService
  });
  const searchService = options.searchService || createSearchService({
    providerRegistry,
    maxResults: env.maxResults,
    productResearchService,
    candidateRevalidationService
  });
  const alertStore = options.alertStore || createPriceAlertStore({ filePath: env.priceAlertsFile });
  const alertService = options.alertService || createPriceAlertService({
    store: alertStore,
    searchService,
    candidateRevalidationService,
    defaultIntervalMs: env.priceAlertRecheckIntervalMs
  });
  const alertJob = options.startJobs && env.priceAlertsEnabled
    ? startPriceAlertJob({ alertService, cadenceMs: env.priceAlertJobIntervalMs }) : undefined;
  const rateLimiter = options.rateLimiter || createRateLimiter({
    enabled: env.rateLimitEnabled,
    windowMs: env.rateLimitWindowMs,
    maxRequests: env.rateLimitMaxRequests,
    trustProxyHeaders: env.trustProxyHeaders
  });
  const searchCache = options.searchCache || createResponseCache({
    enabled: env.searchCacheEnabled,
    ttlMs: env.searchCacheTtlMs,
    maxEntries: env.searchCacheMaxEntries
  });
  const logger = options.logger || createSafeLogger({ enabled: env.requestLoggingEnabled });

  async function app(request, response) {
    const startedAt = Date.now();
    let url;
    const logState = { cache: 'NONE', rateLimited: false };

    response.on('finish', () => {
      logger.request({
        method: request.method,
        pathname: url?.pathname || '/',
        statusCode: response.statusCode,
        durationMs: Date.now() - startedAt,
        cache: logState.cache,
        rateLimited: logState.rateLimited
      });
    });

    try {
      url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
      const checkAlertId = alertIdFromPath(url.pathname, '/check');
      const alertId = alertIdFromPath(url.pathname);

      if (shouldRateLimit(request.method, url.pathname)) {
        const blocked = enforceRateLimit({
          request,
          response,
          rateLimiter,
          limit: env.rateLimitMaxRequests,
          logState
        });

        if (blocked) return undefined;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        return sendJson(response, 200, createHealthPayload({ providerRegistry, env, alertJob }));
      }
      if (request.method === 'GET' && url.pathname === '/api/search') {
        return await handleCachedSearchRequest({
          url,
          response,
          searchService,
          searchCache,
          defaultCountry: env.defaultCountry,
          defaultCurrency: env.defaultCurrency,
          defaultSearchMode: env.searchMode,
          logState
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/alerts') {
        return await handleListAlertsRequest({ response, alertService });
      }
      if (request.method === 'POST' && url.pathname === '/api/candidates/revalidate') {
        return await handleCandidateRevalidationRequest({
          request,
          response,
          candidateRevalidationService,
          bodyLimitBytes: env.requestBodyLimitBytes
        });
      }
      if (request.method === 'POST' && url.pathname === '/api/alerts') {
        return await handleCreateAlertRequest({
          request,
          response,
          alertService,
          bodyLimitBytes: env.requestBodyLimitBytes
        });
      }

      if (request.method === 'POST' && checkAlertId) {
        return await handleCheckAlertRequest({ response, alertService, alertId: checkAlertId });
      }

      if (request.method === 'DELETE' && alertId) {
        return await handleDeleteAlertRequest({ response, alertService, alertId });
      }

      if (request.method === 'GET') {
        const served = await serveStaticFile({ url, response, publicDir });

        if (served) return undefined;
      }

      return sendJson(response, 404, {
        error: { code: 'NOT_FOUND', message: 'Rota nao encontrada.' }
      });
    } catch (error) {
      return sendError(response, error);
    }
  }

  app.close = () => {
    alertJob?.stop();
  };

  return app;
}
