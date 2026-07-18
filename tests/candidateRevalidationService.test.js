import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCandidateRevalidationService
} from '../src/modules/ai-search/candidateRevalidationService.js';

const verifiedAt = new Date('2026-07-18T13:00:00.000Z');

function candidate(overrides = {}) {
  return {
    productTitle: 'Notebook revalidado',
    storeName: 'Loja verificavel',
    productUrl: 'https://example.com/notebook',
    visiblePrice: { amountCents: 250000, currency: 'BRL' },
    shipping: { exposed: true, amountCents: 1800, currency: 'BRL', warning: null },
    taxes: { exposed: true, amountCents: 3200, currency: 'BRL', warning: null },
    evidence: [{
      url: 'https://example.com/notebook',
      title: 'Pagina consultada',
      snippet: 'Trecho com preco visivel e dados de compra.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'high',
    warnings: [],
    availability: 'available',
    delivery: { minDays: 2, maxDays: 5 },
    ...overrides
  };
}

function serviceReturning(candidates, seen = {}) {
  return createCandidateRevalidationService({
    now: () => verifiedAt,
    productResearchService: {
      async research(input) {
        seen.input = input;
        return { candidates, meta: { warnings: [] } };
      }
    }
  });
}

test('candidateRevalidationService confirma candidato igual com evidencia HTTPS', async () => {
  const seen = {};
  const service = serviceReturning([candidate()], seen);
  const result = await service.revalidate({ candidate: candidate(), context: { country: 'BR', currency: 'BRL' } });

  assert.equal(result.status, 'confirmado');
  assert.equal(result.lastVerifiedAt, verifiedAt.toISOString());
  assert.equal(result.comparisons.price.changed, false);
  assert.equal(seen.input.context.revalidation.productUrl, 'https://example.com/notebook');
});

test('candidateRevalidationService marca preco alterado sem inventar diferenca', async () => {
  const service = serviceReturning([candidate({ visiblePrice: { amountCents: 240000, currency: 'BRL' } })]);
  const result = await service.revalidate({ candidate: candidate(), context: { country: 'BR', currency: 'BRL' } });

  assert.equal(result.status, 'alterado');
  assert.equal(result.comparisons.price.previous.amountCents, 250000);
  assert.equal(result.comparisons.price.current.amountCents, 240000);
  assert.equal(result.comparisons.price.changed, true);
});

test('candidateRevalidationService marca candidato nao verificavel sem diferenca ficticia', async () => {
  const service = serviceReturning([candidate({ productUrl: 'https://example.com/outro-notebook' })]);
  const result = await service.revalidate({ candidate: candidate(), context: { country: 'BR', currency: 'BRL' } });

  assert.equal(result.status, 'nao_verificavel');
  assert.equal(result.currentCandidate, null);
  assert.deepEqual(result.comparisons, {});
});

test('candidateRevalidationService mantem sem imposto como incompleto', async () => {
  const service = serviceReturning([candidate({
    taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao confirmado.' }
  })]);
  const result = await service.revalidate({ candidate: candidate(), context: { country: 'BR', currency: 'BRL' } });

  assert.equal(result.status, 'incompleto');
  assert.equal(result.comparisons.taxes.current.exposed, false);
  assert.equal(result.comparisons.taxes.changed, null);
});
