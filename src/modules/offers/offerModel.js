const REAL_SOURCE_TYPES = new Set(['api', 'feed', 'affiliate', 'partner']);

export const OFFER_MODEL = Object.freeze({
  name: 'Offer',
  version: 1,
  requiredFields: Object.freeze([
    'providerName',
    'source.type',
    'source.name',
    'productTitle',
    'productUrl',
    'seller.name',
    'price.amountCents',
    'price.currency',
    'shipping.amountCents',
    'shipping.currency',
    'taxes.amountCents',
    'taxes.currency'
  ])
});

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoCurrency(value) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function isHttpsUrl(value) {
  if (!hasText(value)) {
    return false;
  }

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateMoneyField(errors, fieldName, value, { allowZero }) {
  if (!isPlainObject(value)) {
    errors.push(`${fieldName} invalido.`);
    return;
  }

  if (!Number.isInteger(value.amountCents) || value.amountCents < 0) {
    errors.push(`${fieldName}.amountCents invalido.`);
  }

  if (!allowZero && value.amountCents === 0) {
    errors.push(`${fieldName}.amountCents precisa ser maior que zero.`);
  }

  if (!isIsoCurrency(value.currency)) {
    errors.push(`${fieldName}.currency invalida.`);
  }
}

function validateSource(errors, source) {
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

  if (source.url !== undefined && !isHttpsUrl(source.url)) {
    errors.push('source.url invalida.');
  }
}

function validateSeller(errors, seller) {
  if (!isPlainObject(seller) || !hasText(seller.name)) {
    errors.push('seller.name ausente.');
  }
}

function hasSameCurrency(offer) {
  return (
    offer.price.currency === offer.shipping.currency &&
    offer.price.currency === offer.taxes.currency
  );
}

function validateExpectedCurrency(errors, offer, expectedCurrency) {
  if (!isIsoCurrency(expectedCurrency) || !isPlainObject(offer.price)) {
    return;
  }

  if (isIsoCurrency(offer.price.currency) && offer.price.currency !== expectedCurrency) {
    errors.push('moeda diverge do contexto de busca.');
  }
}

export function validateOffer(offer, options = {}) {
  const errors = [];

  if (!isPlainObject(offer)) {
    return {
      valid: false,
      errors: ['O item nao e uma oferta valida.']
    };
  }

  if (!hasText(offer.providerName)) {
    errors.push('providerName ausente.');
  }

  if (hasText(options.expectedProviderName) && offer.providerName !== options.expectedProviderName) {
    errors.push('providerName diverge do provedor configurado.');
  }

  validateSource(errors, offer.source);

  if (!hasText(offer.productTitle)) {
    errors.push('productTitle ausente.');
  }

  if (!isHttpsUrl(offer.productUrl)) {
    errors.push('productUrl invalido.');
  }

  validateSeller(errors, offer.seller);
  validateMoneyField(errors, 'price', offer.price, { allowZero: false });
  validateMoneyField(errors, 'shipping', offer.shipping, { allowZero: true });
  validateMoneyField(errors, 'taxes', offer.taxes, { allowZero: true });

  if (
    isPlainObject(offer.price) &&
    isPlainObject(offer.shipping) &&
    isPlainObject(offer.taxes) &&
    isIsoCurrency(offer.price.currency) &&
    isIsoCurrency(offer.shipping.currency) &&
    isIsoCurrency(offer.taxes.currency) &&
    !hasSameCurrency(offer)
  ) {
    errors.push('moedas diferentes na mesma oferta.');
  }

  validateExpectedCurrency(errors, offer, options.expectedCurrency);

  return {
    valid: errors.length === 0,
    errors
  };
}
