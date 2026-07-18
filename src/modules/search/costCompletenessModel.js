import { cleanText, isPlainObject } from './contractUtils.js';

export const COST_COMPLETENESS_MODEL = Object.freeze({
  name: 'CostCompleteness',
  version: 1,
  statuses: Object.freeze(['complete', 'incomplete', 'needs_confirmation', 'unavailable']),
  requiredComponents: Object.freeze(['product', 'shipping', 'taxes'])
});

export function isUnavailableText(value) {
  return /indisponivel|esgotado|sem estoque|unavailable|out of stock/.test(cleanText(value).toLowerCase());
}

export function createCostCompletenessFromWebCandidate(candidate) {
  const missingComponents = [];
  const warnings = [];

  if (candidate?.shipping?.exposed !== true) {
    missingComponents.push('shipping');
    warnings.push(candidate?.shipping?.warning || 'Frete nao exposto; custo total incompleto.');
  }

  if (candidate?.taxes?.exposed !== true) {
    missingComponents.push('taxes');
    warnings.push(candidate?.taxes?.warning || 'Imposto nao confirmado; custo total incompleto.');
  }

  if (candidate?.confidence === 'low') {
    warnings.push('Confianca baixa; precisa confirmacao no site da loja.');
  }

  const status = isUnavailableText(candidate?.availability)
    ? 'unavailable'
    : missingComponents.length > 0
      ? 'incomplete'
      : candidate?.confidence === 'low'
        ? 'needs_confirmation'
        : 'complete';

  return {
    model: COST_COMPLETENESS_MODEL.name,
    modelVersion: COST_COMPLETENESS_MODEL.version,
    status,
    complete: status === 'complete',
    requiredComponents: [...COST_COMPLETENESS_MODEL.requiredComponents],
    missingComponents,
    warnings: [...new Set(warnings.filter(Boolean))]
  };
}

export function validateCostCompleteness(value) {
  const errors = [];

  if (!isPlainObject(value)) {
    return { valid: false, errors: ['CostCompleteness ausente.'] };
  }

  if (!COST_COMPLETENESS_MODEL.statuses.includes(value.status)) {
    errors.push('CostCompleteness.status invalido.');
  }
  if (typeof value.complete !== 'boolean') {
    errors.push('CostCompleteness.complete precisa ser booleano.');
  }
  if (!Array.isArray(value.missingComponents)) {
    errors.push('CostCompleteness.missingComponents precisa ser lista.');
  }

  return { valid: errors.length === 0, errors };
}
