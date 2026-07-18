import test from 'node:test';
import assert from 'node:assert/strict';
import { rankOffers } from '../src/modules/offers/offerRanker.js';
import { validateOffer } from '../src/modules/offers/offerValidation.js';

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
    delivery: { minDays: 2, maxDays: 5 },
    ...overrides
  };
}

test('rankOffers ordena pelo custo total com frete e imposto', () => {
  const ranked = rankOffers([
    offer({
      productTitle: 'Oferta aparentemente barata',
      price: { amountCents: 9000, currency: 'BRL' },
      shipping: { amountCents: 3000, currency: 'BRL' },
      taxes: { amountCents: 1000, currency: 'BRL' }
    }),
    offer({
      productTitle: 'Melhor custo total',
      price: { amountCents: 10000, currency: 'BRL' },
      shipping: { amountCents: 500, currency: 'BRL' },
      taxes: { amountCents: 200, currency: 'BRL' }
    })
  ]);

  assert.equal(ranked[0].productTitle, 'Melhor custo total');
  assert.equal(ranked[0].totalCost.amountCents, 10700);
  assert.equal(ranked[0].totalCost.breakdown.product.amountCents, 10000);
  assert.equal(ranked[0].totalCost.breakdown.shipping.amountCents, 500);
  assert.equal(ranked[0].totalCost.breakdown.taxes.amountCents, 200);
});

test('rankOffers penaliza oferta de vitrine barata que fica cara no total', () => {
  const ranked = rankOffers([
    offer({
      productTitle: 'Preco de vitrine menor',
      price: { amountCents: 8000, currency: 'BRL' },
      shipping: { amountCents: 6000, currency: 'BRL' },
      taxes: { amountCents: 2000, currency: 'BRL' }
    }),
    offer({
      productTitle: 'Custo total honesto',
      price: { amountCents: 10500, currency: 'BRL' },
      shipping: { amountCents: 800, currency: 'BRL' },
      taxes: { amountCents: 200, currency: 'BRL' }
    })
  ]);

  assert.equal(ranked[0].productTitle, 'Custo total honesto');
  assert.equal(ranked[0].totalCost.amountCents, 11500);
  assert.equal(ranked[1].totalCost.amountCents, 16000);
});

test('rankOffers retorna top 3 com desempate por prazo, reputacao e titulo', () => {
  const ranked = rankOffers([
    offer({
      productTitle: 'Titulo B',
      delivery: { minDays: 1, maxDays: 5 },
      seller: { name: 'Loja de teste do contrato', reputationScore: 0.9 }
    }),
    offer({
      productTitle: 'Prazo melhor',
      delivery: { minDays: 1, maxDays: 3 },
      seller: { name: 'Loja de teste do contrato', reputationScore: 0.1 }
    }),
    offer({
      productTitle: 'Reputacao melhor',
      delivery: { minDays: 1, maxDays: 5 },
      seller: { name: 'Loja de teste do contrato', reputationScore: 0.95 }
    }),
    offer({
      productTitle: 'Titulo A',
      delivery: { minDays: 1, maxDays: 5 },
      seller: { name: 'Loja de teste do contrato', reputationScore: 0.9 }
    })
  ]);

  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].productTitle, 'Prazo melhor');
  assert.equal(ranked[1].productTitle, 'Reputacao melhor');
  assert.equal(ranked[2].productTitle, 'Titulo A');
  assert.deepEqual(ranked.map((item) => item.ranking.position), [1, 2, 3]);
  assert.equal(ranked[0].ranking.criteria.maxDeliveryDays, 3);
  assert.equal(ranked[1].ranking.criteria.reputationScore, 0.95);
  assert.match(ranked[0].ranking.explanation, /custo total/);
});

test('validateOffer rejeita oferta sem frete ou imposto', () => {
  const validation = validateOffer(
    offer({
      shipping: undefined
    })
  );

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('shipping invalido.'));
});

test('validateOffer aceita frete nao exposto somente com aviso', () => {
  const validation = validateOffer(
    offer({
      shipping: {
        amountCents: 0,
        currency: 'BRL',
        exposed: false,
        warning: 'Frete nao exposto pelo provedor.'
      }
    })
  );

  assert.equal(validation.valid, true);
});

test('rankOffers coloca oferta com frete exposto antes de subtotal conhecido', () => {
  const ranked = rankOffers([
    offer({
      productTitle: 'Subtotal conhecido menor',
      price: { amountCents: 8000, currency: 'BRL' },
      shipping: {
        amountCents: 0,
        currency: 'BRL',
        exposed: false,
        warning: 'Frete nao exposto pelo provedor.'
      },
      taxes: { amountCents: 500, currency: 'BRL' }
    }),
    offer({
      productTitle: 'Custo total completo',
      price: { amountCents: 10000, currency: 'BRL' },
      shipping: { amountCents: 1000, currency: 'BRL' },
      taxes: { amountCents: 500, currency: 'BRL' }
    })
  ]);

  assert.equal(ranked[0].productTitle, 'Custo total completo');
  assert.equal(ranked[0].totalCost.complete, true);
  assert.equal(ranked[1].productTitle, 'Subtotal conhecido menor');
  assert.equal(ranked[1].totalCost.complete, false);
  assert.match(ranked[1].ranking.explanation, /subtotal conhecido/);
});

test('validateOffer rejeita oferta sem loja, link seguro ou origem real', () => {
  const validation = validateOffer(
    offer({
      source: undefined,
      productUrl: 'http://example.com/produto-contrato',
      seller: undefined
    })
  );

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('source ausente.'));
  assert.ok(validation.errors.includes('productUrl invalido.'));
  assert.ok(validation.errors.includes('seller.name ausente.'));
});

test('validateOffer rejeita preco zero e moeda inconsistente', () => {
  const validation = validateOffer(
    offer({
      price: { amountCents: 0, currency: 'BRL' },
      shipping: { amountCents: 1000, currency: 'USD' }
    })
  );

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('price.amountCents precisa ser maior que zero.'));
  assert.ok(validation.errors.includes('moedas diferentes na mesma oferta.'));
});

test('validateOffer rejeita moeda diferente do contexto da busca', () => {
  const validation = validateOffer(
    offer({
      price: { amountCents: 10000, currency: 'USD' },
      shipping: { amountCents: 1000, currency: 'USD' },
      taxes: { amountCents: 500, currency: 'USD' }
    }),
    {
      expectedCurrency: 'BRL'
    }
  );

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('moeda diverge do contexto de busca.'));
});

test('rankOffers nao coloca oferta invalida no ranking', () => {
  const ranked = rankOffers([
    offer({
      productTitle: 'Oferta sem origem',
      source: undefined
    }),
    offer({
      productTitle: 'Oferta valida',
      price: { amountCents: 12000, currency: 'BRL' }
    })
  ]);

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].productTitle, 'Oferta valida');
});

test('rankOffers inclui nivel de confianca quando a oferta foi verificada', () => {
  const ranked = rankOffers([
    offer({
      verification: {
        confidenceLevel: 'medium',
        evidence: [{ field: 'price', url: 'https://example.com/evidence' }]
      }
    })
  ]);

  assert.equal(ranked[0].ranking.criteria.confidenceLevel, 'medium');
  assert.match(ranked[0].ranking.explanation, /confianca medium/);
});
