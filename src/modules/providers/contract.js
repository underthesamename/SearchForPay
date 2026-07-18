import { ConfigurationError } from '../../shared/errors.js';
import { PROVIDER_MODEL, validateProvider } from './providerModel.js';

export function ensureProviderContract(provider) {
  const validation = validateProvider(provider);

  if (!validation.valid) {
    throw new ConfigurationError('Adaptador de provedor invalido.', {
      errors: validation.errors
    });
  }

  return provider;
}

export { PROVIDER_MODEL, validateProvider };
