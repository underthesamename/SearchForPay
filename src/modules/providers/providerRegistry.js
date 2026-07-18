import { ensureProviderContract } from './contract.js';
import { createEbayBrowseProvider } from './adapters/ebayBrowseAdapter.js';
import { createGoogleMerchantProvider } from './adapters/googleMerchantAdapter.js';
import { createLomadeeProvider } from './adapters/lomadeeAdapter.js';
import { createOpenAiWebProvider } from './adapters/openaiSearchAdapter.js';
import { createShopifyStorefrontProvider } from './adapters/shopifyStorefrontAdapter.js';

const adapterFactories = new Map([
  ['ebay', createEbayBrowseProvider],
  ['googlemerchant', createGoogleMerchantProvider],
  ['lomadee', createLomadeeProvider],
  ['openaiweb', createOpenAiWebProvider],
  ['shopify', createShopifyStorefrontProvider]
]);

function normalizeProviderName(name) {
  return String(name || '').trim().toLowerCase();
}

function disabledProvider(name, providerOptions) {
  const options = providerOptions[name] || {};

  if (name === 'openaiweb' && options.enabled !== true) {
    return {
      providerName: name,
      reason: options.disabledReason || 'OPENAI_SEARCH_ENABLED=false.'
    };
  }

  return undefined;
}

export function registerProviderAdapter(name, factory) {
  const normalizedName = normalizeProviderName(name);

  if (!normalizedName || typeof factory !== 'function') {
    throw new Error('Nome ou fabrica de provedor invalido.');
  }

  adapterFactories.set(normalizedName, factory);
}

export function createProviderRegistry({ providerNames = [], providerOptions = {} } = {}) {
  const configuredProviderNames = [...new Set(providerNames.map(normalizeProviderName).filter(Boolean))];
  const unknownProviders = configuredProviderNames.filter((name) => !adapterFactories.has(name));
  const disabledProviders = configuredProviderNames
    .filter((name) => adapterFactories.has(name))
    .map((name) => disabledProvider(name, providerOptions))
    .filter(Boolean);
  const disabledProviderNames = new Set(disabledProviders.map((provider) => provider.providerName));
  const enabledProviders = configuredProviderNames
    .filter((name) => adapterFactories.has(name) && !disabledProviderNames.has(name))
    .map((name) => ensureProviderContract(adapterFactories.get(name)(providerOptions[name] || {})));

  return {
    getConfiguredProviderNames() {
      return configuredProviderNames;
    },

    getUnknownProviders() {
      return unknownProviders;
    },

    getDisabledProviders() {
      return disabledProviders;
    },

    getEnabledProviders() {
      return enabledProviders;
    },

    getEnabledProviderNames() {
      return enabledProviders.map((provider) => provider.name);
    }
  };
}
