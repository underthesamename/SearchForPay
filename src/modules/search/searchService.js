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

function publicProviderReport({ providerName, offersReceived, validOffers, invalidOffers }) {
  return {
    providerName,
    status: 'ok',
    offersReceived,
    validOffers,
    invalidOffers
  };
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
            const offers = await provider.search(request);

            if (!Array.isArray(offers)) {
              return {
                providerName: provider.name,
                status: 'failed'
              };
            }

            return {
              providerName: provider.name,
              status: 'ok',
              offers
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

        const { providerName, offers } = result;
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
          invalidOffers: offers.length - providerValidOfferCount
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
