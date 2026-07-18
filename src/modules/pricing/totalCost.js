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

  return {
    key: definition.key,
    label: definition.label,
    amountCents: money.amountCents,
    currency: money.currency,
    required: definition.required
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
      {
        amountCents: component.amountCents,
        currency: component.currency,
        label: component.label,
        required: component.required
      }
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

  return {
    amountCents: components.reduce((sum, component) => sum + component.amountCents, 0),
    currency: components[0].currency,
    formula: 'product + shipping + taxes',
    components,
    breakdown: toBreakdown(components),
    futureRules: FUTURE_COST_RULES
  };
}
