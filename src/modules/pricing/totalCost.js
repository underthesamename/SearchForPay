import { validateOffer } from '../offers/offerValidation.js';

export const COST_COMPONENTS = Object.freeze([
  Object.freeze({
    key: 'product',
    label: 'Produto',
    offerField: 'price',
    required: true
  }),
  Object.freeze({
    key: 'shipping',
    label: 'Frete',
    offerField: 'shipping',
    required: true
  }),
  Object.freeze({
    key: 'taxes',
    label: 'Imposto',
    offerField: 'taxes',
    required: true
  })
]);

export const FUTURE_COST_RULES = Object.freeze({
  coupon: Object.freeze({
    status: 'reserved',
    appliesToTotal: false,
    rule: 'Cupom so pode alterar custo total quando vier de fonte real e verificavel.'
  }),
  delivery: Object.freeze({
    status: 'ranking_tie_breaker',
    appliesToTotal: false,
    rule: 'Prazo pode desempatar ranking, mas nao altera produto + frete + imposto.'
  }),
  reputation: Object.freeze({
    status: 'ranking_tie_breaker',
    appliesToTotal: false,
    rule: 'Reputacao pode desempatar ranking, mas nao altera produto + frete + imposto.'
  })
});

export class CostCalculationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'CostCalculationError';
    this.details = details;
  }
}

function createComponent(offer, definition) {
  const money = offer[definition.offerField];
  const exposed = money.exposed !== false;

  return {
    key: definition.key,
    label: definition.label,
    amountCents: money.amountCents,
    currency: money.currency,
    required: definition.required,
    exposed,
    includedInTotal: exposed,
    warning: money.warning
  };
}

function assertSingleCurrency(components) {
  const currencies = new Set(components.map((component) => component.currency));

  if (currencies.size !== 1) {
    throw new CostCalculationError('Moedas inconsistentes no calculo de custo total.', {
      currencies: [...currencies]
    });
  }
}

function toBreakdown(components) {
  return Object.fromEntries(
    components.map((component) => [
      component.key,
      Object.fromEntries(Object.entries({
        amountCents: component.amountCents,
        currency: component.currency,
        label: component.label,
        required: component.required,
        exposed: component.exposed === false ? false : undefined,
        includedInTotal: component.includedInTotal === false ? false : undefined,
        warning: component.warning
      }).filter(([, value]) => value !== undefined))
    ])
  );
}

export function calculateTotalCost(offer, options = {}) {
  const validation = validateOffer(offer, {
    expectedCurrency: options.expectedCurrency
  });

  if (!validation.valid) {
    throw new CostCalculationError('Oferta invalida para calculo de custo total.', {
      errors: validation.errors
    });
  }

  const components = COST_COMPONENTS.map((definition) => createComponent(offer, definition));

  assertSingleCurrency(components);

  const missingComponents = components
    .filter((component) => component.exposed === false)
    .map((component) => component.key);
  const complete = missingComponents.length === 0;
  const warnings = components
    .filter((component) => component.exposed === false)
    .map((component) => component.warning || `${component.label} nao exposto pelo provedor.`);

  return {
    amountCents: components
      .filter((component) => component.includedInTotal)
      .reduce((sum, component) => sum + component.amountCents, 0),
    currency: components[0].currency,
    complete,
    missingComponents,
    warnings,
    formula: complete ? 'product + shipping + taxes' : 'product + taxes; shipping not exposed',
    components,
    breakdown: toBreakdown(components),
    futureRules: FUTURE_COST_RULES
  };
}
