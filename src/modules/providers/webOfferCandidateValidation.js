const CONFIDENCE_LEVELS = new Set(['high', 'medium', 'low']);

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpsUrl(value) {
  if (!hasText(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isIsoCurrency(value) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

function validateMoney(errors, fieldName, value, { allowZero, requiredCurrency } = {}) {
  if (!isPlainObject(value)) {
    errors.push(`${fieldName} ausente.`);
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
  } else if (isIsoCurrency(requiredCurrency) && value.currency !== requiredCurrency) {
    errors.push(`${fieldName}.currency diverge do preco visivel.`);
  }
}

function validateCost(errors, fieldName, value, visibleCurrency, missingMessage) {
  if (!isPlainObject(value)) {
    errors.push(`${fieldName} ausente.`);
    return;
  }

  if (typeof value.exposed !== 'boolean') {
    errors.push(`${fieldName}.exposed precisa ser booleano.`);
    return;
  }

  if (value.exposed) {
    validateMoney(errors, fieldName, value, { allowZero: true, requiredCurrency: visibleCurrency });
    return;
  }

  if (value.amountCents !== undefined && value.amountCents !== null) {
    errors.push(`${fieldName}.amountCents deve ficar ausente quando ${missingMessage}.`);
  }
}

function validateShipping(errors, candidate) {
  validateCost(errors, 'shipping', candidate.shipping, candidate.visiblePrice?.currency, 'o frete nao foi exposto');

  if (isPlainObject(candidate.shipping) && candidate.shipping.exposed === false && !hasText(candidate.shipping.warning)) {
    errors.push('shipping.warning ausente para frete nao exposto.');
  }
}

function validateTaxes(errors, candidate) {
  validateCost(errors, 'taxes', candidate.taxes, candidate.visiblePrice?.currency, 'o imposto nao foi confirmado');

  if (isPlainObject(candidate.taxes) && candidate.taxes.exposed === false && !hasText(candidate.taxes.warning)) {
    errors.push('taxes.warning ausente para imposto nao confirmado.');
  }
}

function isUnavailable(value) {
  return /indisponivel|esgotado|sem estoque|unavailable|out of stock/.test(String(value || '').toLowerCase());
}

function validateEvidence(errors, evidence) {
  if (!Array.isArray(evidence) || evidence.length === 0) {
    errors.push('evidence precisa ter pelo menos uma fonte clicavel.');
    return;
  }

  evidence.forEach((item, index) => {
    if (!isPlainObject(item)) {
      errors.push(`evidence[${index}] invalida.`);
      return;
    }

    if (!isHttpsUrl(item.url)) {
      errors.push(`evidence[${index}].url precisa ser HTTPS.`);
    }

    if (!hasText(item.title)) {
      errors.push(`evidence[${index}].title ausente.`);
    }

    if (!hasText(item.snippet) || item.snippet.trim().length > 360) {
      errors.push(`evidence[${index}].snippet ausente ou longo demais.`);
    }

    if (!hasText(item.accessedAt) || Number.isNaN(Date.parse(item.accessedAt))) {
      errors.push(`evidence[${index}].accessedAt invalido.`);
    }
  });
}

export function validateWebOfferCandidate(candidate) {
  const errors = [];

  if (!isPlainObject(candidate)) {
    return { valid: false, errors: ['WebOfferCandidate invalido.'] };
  }

  if (!hasText(candidate.productTitle)) errors.push('productTitle ausente.');
  if (!hasText(candidate.storeName)) errors.push('storeName ausente.');
  if (!isHttpsUrl(candidate.productUrl)) errors.push('productUrl precisa ser HTTPS.');

  validateMoney(errors, 'visiblePrice', candidate.visiblePrice, { allowZero: false });
  validateShipping(errors, candidate);
  validateTaxes(errors, candidate);
  validateEvidence(errors, candidate.evidence);

  if (!CONFIDENCE_LEVELS.has(candidate.confidence)) errors.push('confidence invalida.');

  if (!Array.isArray(candidate.warnings) || candidate.warnings.some((warning) => typeof warning !== 'string')) {
    errors.push('warnings precisa ser uma lista de textos.');
  }

  return { valid: errors.length === 0, errors };
}

export function getWebCandidatePromotionBlockers(candidate) {
  const validation = validateWebOfferCandidate(candidate);
  const blockers = [...validation.errors];

  if (validation.valid && candidate.shipping.exposed !== true) blockers.push('shipping real nao confirmado.');
  if (validation.valid && candidate.taxes.exposed !== true) blockers.push('taxes real nao confirmado.');
  if (validation.valid && isUnavailable(candidate.availability)) blockers.push('availability indisponivel.');
  if (validation.valid && candidate.confidence === 'low') blockers.push('confidence low fica apenas como candidato.');

  return blockers;
}

export function canPromoteWebCandidateToOffer(candidate) {
  return getWebCandidatePromotionBlockers(candidate).length === 0;
}
