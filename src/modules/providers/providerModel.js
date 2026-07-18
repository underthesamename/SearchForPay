const REAL_SOURCE_TYPES = new Set(['api', 'feed', 'affiliate', 'partner']);

export const PROVIDER_MODEL = Object.freeze({
  name: 'Provider',
  version: 1,
  requiredFields: Object.freeze(['name', 'source.type', 'source.name', 'search'])
});

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateProviderSource(errors, source) {
  if (!isPlainObject(source)) {
    errors.push('source ausente.');
    return;
  }

  if (!hasText(source.name)) {
    errors.push('source.name ausente.');
  }

  if (!hasText(source.type) || !REAL_SOURCE_TYPES.has(source.type)) {
    errors.push('source.type invalido.');
  }
}

export function validateProvider(provider) {
  const errors = [];

  if (!isPlainObject(provider)) {
    return {
      valid: false,
      errors: ['Adaptador de provedor invalido.']
    };
  }

  if (!hasText(provider.name)) {
    errors.push('name ausente.');
  }

  validateProviderSource(errors, provider.source);

  if (typeof provider.search !== 'function') {
    errors.push('search ausente.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
