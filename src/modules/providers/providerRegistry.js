import { ensureProviderContract } from './contract.js';
import { createEbayBrowseProvider } from './adapters/ebayBrowseAdapter.js';
import { createGoogleMerchantProvider } from './adapters/googleMerchantAdapter.js';
import { createShopifyStorefrontProvider } from './adapters/shopifyStorefrontAdapter.js';

const adapterFactories = new Map([
  ['ebay', createEbayBrowseProvider],
  ['googlemerchant', createGoogleMerchantProvider],
  ['shopify', createShopifyStorefrontProvider]
]);

function normalizeProviderName(name) {
  return String(name || '').trim().toLowerCase();
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
  const enabledProviders = configuredProviderNames
    .filter((name) => adapterFactories.has(name))
    .map((name) => ensureProviderContract(adapterFactories.get(name)(providerOptions[name] || {})));

  return {
    getConfiguredProviderNames() {
      return configuredProviderNames;
    },

    getUnknownProviders() {
      return unknownProviders;
    },

    getEnabledProviders() {
      return enabledProviders;
    },

    getEnabledProviderNames() {
      return enabledProviders.map((provider) => provider.name);
    }
  };
}
