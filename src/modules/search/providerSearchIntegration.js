import { AppError } from '../../shared/errors.js';
import { validateOffer } from '../offers/offerValidation.js';
import { ensureProviderContract } from '../providers/contract.js';
import { isOpenAiWebProvider } from './webResearchIntegration.js';

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
  return { providerName, status: 'ok', offersReceived, validOffers, invalidOffers, ...report };
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function sanitizeProviderReport(report) {
  if (!isPlainObject(report)) return {};

  return Object.fromEntries(
    ['candidatesExtracted', 'candidatesRejected', 'verificationLayer']
      .filter((key) => report[key] !== undefined)
      .map((key) => [key, report[key]])
  );
}

function normalizeProviderSearchPayload(payload) {
  if (Array.isArray(payload)) return { offers: payload, report: {} };

  if (isPlainObject(payload) && Array.isArray(payload.offers)) {
    return {
      offers: payload.offers,
      report: sanitizeProviderReport(payload.report)
    };
  }

  return undefined;
}

export function getMarketplaceProviders(providerRegistry) {
  return providerRegistry.getEnabledProviders()
    .map(ensureProviderContract)
    .filter((provider) => !isOpenAiWebProvider(provider));
}

export async function runMarketplaceProviders(providers, request) {
  return Promise.all(providers.map(async (provider) => {
    try {
      const payload = normalizeProviderSearchPayload(await provider.search(request));
      return payload
        ? { providerName: provider.name, status: 'ok', ...payload }
        : { providerName: provider.name, status: 'failed' };
    } catch (error) {
      return { providerName: provider.name, status: 'failed', error };
    }
  }));
}

export function collectProviderOffers(providerResults, request) {
  const providerReports = [];
  const validOffers = [];
  let invalidOfferCount = 0;

  for (const result of providerResults) {
    if (result.status === 'failed') {
      providerReports.push(publicProviderError(result.providerName, result.error));
      continue;
    }

    const { providerName, offers, report } = result;
    const beforeCount = validOffers.length;

    for (const offer of offers) {
      const validation = validateOffer(offer, {
        expectedProviderName: providerName,
        expectedCurrency: request.context.currency
      });

      if (validation.valid) validOffers.push(offer);
      else invalidOfferCount += 1;
    }

    providerReports.push(publicProviderReport({
      providerName,
      offersReceived: offers.length,
      validOffers: validOffers.length - beforeCount,
      invalidOffers: offers.length - (validOffers.length - beforeCount),
      ...report
    }));
  }

  return { providerReports, validOffers, invalidOfferCount };
}
