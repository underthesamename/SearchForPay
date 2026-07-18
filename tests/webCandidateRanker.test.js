import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEB_CANDIDATE_GROUPS,
  rankWebOfferCandidates
} from '../src/modules/search/searchContracts.js';

const request = Object.freeze({
  query: 'Notebook Gamer',
  normalizedQuery: 'notebook gamer',
  context: { currency: 'BRL', country: 'BR', postalCode: '01001000' }
});

function candidate(overrides = {}) {
  return {
    productTitle: 'Notebook Gamer verificado',
    storeName: 'Loja verificavel',
    productUrl: 'https://example.com/notebook',
    visiblePrice: { amountCents: 250000, currency: 'BRL' },
    shipping: { exposed: true, amountCents: 1800, currency: 'BRL', warning: null },
    taxes: { exposed: true, amountCents: 3200, currency: 'BRL', warning: null },
    evidence: [{
      url: 'https://example.com/notebook',
      title: 'Pagina consultada',
      snippet: 'Trecho com preco visivel, loja e disponibilidade.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'high',
    warnings: [],
    availability: 'available',
    delivery: { minDays: 2, maxDays: 5 },
    ...overrides
  };
}

test('rankWebOfferCandidates coloca custo completo acima de candidato barato incompleto', () => {
  const ranked = rankWebOfferCandidates([
    candidate({
      productTitle: 'Notebook Gamer barato sem custo total',
      visiblePrice: { amountCents: 100000, currency: 'BRL' },
      shipping: { exposed: false, amountCents: null, currency: null, warning: 'Frete nao exposto.' },
      taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao confirmado.' }
    }),
    candidate({ productTitle: 'Notebook Gamer com custo completo', visiblePrice: { amountCents: 300000, currency: 'BRL' } })
  ], request);

  assert.equal(ranked[0].productTitle, 'Notebook Gamer com custo completo');
  assert.equal(ranked[0].ranking.group, WEB_CANDIDATE_GROUPS.COMPLETE);
  assert.equal(ranked[1].ranking.group, WEB_CANDIDATE_GROUPS.INCOMPLETE_COST);
  assert.equal(ranked[1].ranking.criteria.totalCost, null);
  assert.match(ranked[1].ranking.explanation, /preco visivel nao e custo total/);
  assert.doesNotMatch(ranked.map((item) => item.ranking.explanation).join(' '), /melhor pre[cç]o/i);
});

test('rankWebOfferCandidates nao trata imposto ou frete ausente como zero', () => {
  const [ranked] = rankWebOfferCandidates([
    candidate({
      shipping: { exposed: false, amountCents: null, currency: null, warning: 'Frete nao exposto.' },
      taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao confirmado.' }
    })
  ], request);

  assert.equal(ranked.ranking.criteria.totalCost, null);
  assert.equal(ranked.ranking.criteria.shipping, 'ausente');
  assert.equal(ranked.ranking.criteria.taxes, 'ausente');
  assert.deepEqual(ranked.ranking.criteria.missingCostComponents, ['shipping', 'taxes']);
});

test('rankWebOfferCandidates explica cada posicao e separa candidatos fracos', () => {
  const ranked = rankWebOfferCandidates([
    candidate({ productTitle: 'Notebook Gamer confiavel' }),
    candidate({ productTitle: 'Notebook Gamer baixa confianca', confidence: 'low' })
  ], request);

  assert.deepEqual(ranked.map((item) => item.ranking.position), [1, 2]);
  assert.ok(ranked.every((item) => item.ranking.explanation.includes(`Posicao ${item.ranking.position}`)));
  assert.equal(ranked[1].ranking.group, WEB_CANDIDATE_GROUPS.WEAK);
  assert.equal(ranked[1].ranking.criteria.confidenceLevel, 'low');
});
