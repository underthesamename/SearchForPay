import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COST_COMPONENTS,
  CostCalculationError,
  FUTURE_COST_RULES,
  calculateTotalCost
} from '../src/modules/pricing/totalCost.js';

function offer(overrides) {
  return {
    providerName: 'real-provider',
    source: {
      type: 'api',
      name: 'Fonte de teste do contrato',
      url: 'https://example.com/api'
    },
    productTitle: 'Produto de teste do contrato',
    productUrl: 'https://example.com/produto-contrato',
    price: { amountCents: 10000, currency: 'BRL' },
    shipping: { amountCents: 1000, currency: 'BRL' },
    taxes: { amountCents: 500, currency: 'BRL' },
    seller: { name: 'Loja de teste do contrato', reputationScore: 0.9 },
    ...overrides
  };
}

test('calculateTotalCost soma produto, frete e imposto obrigatoriamente', () => {
  const totalCost = calculateTotalCost(
    offer({
      price: { amountCents: 10000, currency: 'BRL' },
      shipping: { amountCents: 2500, currency: 'BRL' },
      taxes: { amountCents: 1500, currency: 'BRL' }
    })
  );

  assert.equal(totalCost.amountCents, 14000);
  assert.equal(totalCost.currency, 'BRL');
  assert.equal(totalCost.formula, 'product + shipping + taxes');
});

test('calculateTotalCost retorna breakdown detalhado e componentes auditaveis', () => {
  const totalCost = calculateTotalCost(offer());

  assert.deepEqual(COST_COMPONENTS.map((component) => component.key), ['product', 'shipping', 'taxes']);
  assert.deepEqual(totalCost.components.map((component) => component.key), ['product', 'shipping', 'taxes']);
  assert.deepEqual(totalCost.breakdown.product, {
    amountCents: 10000,
    currency: 'BRL',
    label: 'Produto',
    required: true
  });
  assert.deepEqual(totalCost.breakdown.shipping, {
    amountCents: 1000,
    currency: 'BRL',
    label: 'Frete',
    required: true
  });
  assert.deepEqual(totalCost.breakdown.taxes, {
    amountCents: 500,
    currency: 'BRL',
    label: 'Imposto',
    required: true
  });
});

test('calculateTotalCost rejeita moedas inconsistentes', () => {
  assert.throws(
    () =>
      calculateTotalCost(
        offer({
          shipping: { amountCents: 1000, currency: 'USD' }
        })
      ),
    CostCalculationError
  );
});

test('calculateTotalCost rejeita moeda diferente do contexto da busca', () => {
  assert.throws(
    () =>
      calculateTotalCost(
        offer({
          price: { amountCents: 10000, currency: 'USD' },
          shipping: { amountCents: 1000, currency: 'USD' },
          taxes: { amountCents: 500, currency: 'USD' }
        }),
        {
          expectedCurrency: 'BRL'
        }
      ),
    CostCalculationError
  );
});

test('calculateTotalCost reserva base futura sem aplicar cupom inventado', () => {
  const totalCost = calculateTotalCost(offer());

  assert.equal(totalCost.futureRules, FUTURE_COST_RULES);
  assert.equal(totalCost.futureRules.coupon.appliesToTotal, false);
  assert.equal(totalCost.futureRules.delivery.status, 'ranking_tie_breaker');
  assert.equal(totalCost.futureRules.reputation.status, 'ranking_tie_breaker');
});

test('calculateTotalCost marca subtotal quando frete nao foi exposto', () => {
  const totalCost = calculateTotalCost(
    offer({
      shipping: {
        amountCents: 0,
        currency: 'BRL',
        exposed: false,
        warning: 'Frete nao exposto pelo provedor.'
      }
    })
  );

  assert.equal(totalCost.complete, false);
  assert.deepEqual(totalCost.missingComponents, ['shipping']);
  assert.equal(totalCost.amountCents, 10500);
  assert.equal(totalCost.breakdown.shipping.exposed, false);
  assert.equal(totalCost.breakdown.shipping.includedInTotal, false);
  assert.equal(totalCost.warnings[0], 'Frete nao exposto pelo provedor.');
});
