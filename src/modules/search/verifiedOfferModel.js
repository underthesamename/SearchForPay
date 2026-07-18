import { ConfigurationError } from '../../shared/errors.js';
import { hasText, isHttpsUrl, isPlainObject, sameCurrency, validateMoney } from './contractUtils.js';
import { validateCostCompleteness } from './costCompletenessModel.js';
import { validateSearchEvidence } from './searchEvidenceModel.js';

export const VERIFIED_OFFER_MODEL = Object.freeze({
  name: 'VerifiedOffer',
  version: 1,
  requiredFields: Object.freeze([
    'searchMode',
    'source.type',
    'productTitle',
    'productUrl',
    'seller.name',
    'price.amountCents',
    'shipping.amountCents',
    'taxes.amountCents',
    'evidence[]',
    'costCompleteness'
  ])
});

function validateEvidenceList(errors, evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push('VerifiedOffer.evidence precisa ter pelo menos uma evidencia.');
    return;
  }

  evidence.forEach((item, index) => {
    const validation = validateSearchEvidence(item);
    if (!validation.valid) {
      validation.errors.forEach((error) => errors.push(`evidence[${index}]: ${error}`));
    }
  });
}

export function validateVerifiedOffer(offer, options = {}) {
  const errors = [];

  if (!isPlainObject(offer)) {
    return { valid: false, errors: ['VerifiedOffer invalida.'] };
  }

  if (offer.searchMode !== 'web_research') errors.push('VerifiedOffer.searchMode precisa ser web_research.');
  if (offer.offerState !== 'oferta_completa') errors.push('VerifiedOffer.offerState precisa ser oferta_completa.');
  if (offer.source?.type !== 'web_search') errors.push('VerifiedOffer.source.type precisa ser web_search.');
  if (!hasText(offer.source?.name)) errors.push('VerifiedOffer.source.name ausente.');
  if (!hasText(offer.productTitle)) errors.push('VerifiedOffer.productTitle ausente.');
  if (!isHttpsUrl(offer.productUrl)) errors.push('VerifiedOffer.productUrl precisa ser HTTPS.');
  if (!hasText(offer.seller?.name)) errors.push('VerifiedOffer.seller.name ausente.');

  validateMoney(errors, 'VerifiedOffer.price', offer.price, {
    allowZero: false,
    expectedCurrency: options.expectedCurrency
  });
  validateMoney(errors, 'VerifiedOffer.shipping', offer.shipping, {
    allowZero: true,
    expectedCurrency: offer.price?.currency
  });
  validateMoney(errors, 'VerifiedOffer.taxes', offer.taxes, {
    allowZero: true,
    expectedCurrency: offer.price?.currency
  });

  if (
    isPlainObject(offer.price) &&
    isPlainObject(offer.shipping) &&
    isPlainObject(offer.taxes) &&
    !sameCurrency(offer.price, offer.shipping, offer.taxes)
  ) {
    errors.push('VerifiedOffer moedas diferentes no custo.');
  }

  validateEvidenceList(errors, offer.evidence);

  const completeness = validateCostCompleteness(offer.costCompleteness);
  if (!completeness.valid) errors.push(...completeness.errors);
  if (completeness.valid && offer.costCompleteness.complete !== true) {
    errors.push('VerifiedOffer exige CostCompleteness completo.');
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidVerifiedOffer(offer, options = {}) {
  const validation = validateVerifiedOffer(offer, options);

  if (!validation.valid) {
    throw new ConfigurationError('VerifiedOffer invalida para SearchResult.', {
      errors: validation.errors
    });
  }
}
