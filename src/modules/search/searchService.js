import { RANKING_RULES, TOP_OFFER_LIMIT, rankOffers } from '../offers/offerRanker.js';
import { validateOffer } from '../offers/offerValidation.js';
import { ensureProviderContract } from '../providers/contract.js';
import { AppError, ServiceUnavailableError } from '../../shared/errors.js';
import { createSearchRequest, createSearchResult } from './searchModels.js';

function publicProviderError(providerName, error) {
  if (error instanceof AppError && error.code === 'CONFIGURATION_ERROR') {
    return {
      providerName,
      status: 'configuration_error',
      message: error.message,
      details: error.details
    };
  }

  return {
    providerName,
    status: 'failed',
    message: 'Provedor indisponivel ou resposta invalida.'
  };
}

function publicProviderReport({ providerName, offersReceived, validOffers, invalidOffers, ...report }) {
  return {
    providerName,
    status: 'ok',
    offersReceived,
    validOffers,
    invalidOffers,
    ...report
  };
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeProviderReport(report) {
  if (!isPlainObject(report)) {
    return {};
  }

  return Object.fromEntries(
    ['candidatesExtracted', 'candidatesRejected', 'verificationLayer']
      .filter((key) => report[key] !== undefined)
      .map((key) => [key, report[key]])
  );
}

function normalizeProviderSearchPayload(payload) {
  if (Array.isArray(payload)) {
    return { offers: payload, report: {} };
  }

  if (isPlainObject(payload) && Array.isArray(payload.offers)) {
    return {
      offers: payload.offers,
      report: sanitizeProviderReport(payload.report)
    };
  }

  return undefined;
}

export function createSearchService({ providerRegistry, maxResults = 3 }) {
  return {
    async search(input) {
      const request = createSearchRequest(input);
      const unknownProviders = providerRegistry.getUnknownProviders();

      if (unknownProviders.length > 0) {
        throw new ServiceUnavailableError('Existe provedor configurado sem adaptador real.', {
          unknownProviders
        });
      }

      const providers = providerRegistry.getEnabledProviders().map(ensureProviderContract);

      if (providers.length === 0) {
        throw new ServiceUnavailableError('Nenhum provedor real esta disponivel para buscar produtos.');
      }

      const providerResults = await Promise.all(
        providers.map(async (provider) => {
          try {
            const payload = normalizeProviderSearchPayload(await provider.search(request));

            if (!payload) {
              return {
                providerName: provider.name,
                status: 'failed'
              };
            }

            return {
              providerName: provider.name,
              status: 'ok',
              ...payload
            };
          } catch (error) {
            return {
              providerName: provider.name,
              status: 'failed',
              error
            };
          }
        })
      );

      const providerReports = [];
      const validOffers = [];
      let invalidOfferCount = 0;

      for (const result of providerResults) {
        if (result.status === 'failed') {
          providerReports.push(publicProviderError(result.providerName, result.error));
          continue;
        }

        const { providerName, offers, report } = result;
        let providerValidOfferCount = 0;

        for (const offer of offers) {
          const validation = validateOffer(offer, {
            expectedProviderName: providerName,
            expectedCurrency: request.context.currency
          });

          if (!validation.valid) {
            invalidOfferCount += 1;
            continue;
          }

          validOffers.push(offer);
          providerValidOfferCount += 1;
        }

        providerReports.push(publicProviderReport({
          providerName,
          offersReceived: offers.length,
          validOffers: providerValidOfferCount,
          invalidOffers: offers.length - providerValidOfferCount,
          ...report
        }));
      }

      if (validOffers.length === 0 && providerReports.every((report) => report.status !== 'ok')) {
        throw new ServiceUnavailableError('Nenhum provedor respondeu com ofertas validas agora.', {
          providers: providerReports
        });
      }

      return createSearchResult({
        request,
        results: rankOffers(validOffers, {
          limit: Math.min(maxResults, TOP_OFFER_LIMIT)
        }),
        meta: {
          generatedAt: new Date().toISOString(),
          normalizedQuery: request.normalizedQuery,
          currency: request.context.currency,
          rankingRules: RANKING_RULES,
          providersQueried: providers.length,
          offersAnalyzed: validOffers.length,
          invalidOffersIgnored: invalidOfferCount,
          providerReports
        }
      });
    }
  };
}
