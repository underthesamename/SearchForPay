import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpenAiWebCandidates } from '../src/modules/providers/adapters/openaiSearchMapper.js';

const searchRequest = Object.freeze({
  query: 'Notebook',
  normalizedQuery: 'notebook',
  context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
});

function candidate(overrides = {}) {
  return {
    productTitle: 'Notebook com evidencia real',
    storeName: 'Fonte informada pela web',
    productUrl: 'https://example.com/notebook',
    visiblePrice: { amountCents: 250000, currency: 'BRL' },
    shipping: {
      exposed: true,
      amountCents: 1800,
      currency: 'BRL',
      warning: null
    },
    taxes: {
      exposed: true,
      amountCents: 3200,
      currency: 'BRL',
      warning: null
    },
    evidence: [{
      url: 'https://example.com/notebook',
      title: 'Pagina consultada do notebook',
      snippet: 'Trecho curto com preco e detalhes consultados na fonte.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'high',
    warnings: ['Dados vieram de pesquisa web e precisam ser conferidos no site.'],
    availability: 'available',
    delivery: { minDays: 2, maxDays: 5 },
    ...overrides
  };
}

test('openaiweb mapper descarta candidato com imposto desconhecido', () => {
  const result = normalizeOpenAiWebCandidates({
    searchRequest,
    payload: {
      candidates: [
        candidate({
          taxes: {
            exposed: false,
            amountCents: null,
            currency: null,
            warning: 'Imposto nao confirmado pela fonte web.'
          }
        })
      ]
    }
  });

  assert.equal(result.offers.length, 0);
  assert.equal(result.report.candidatesExtracted, 1);
  assert.equal(result.report.candidatesRejected, 1);
});

test('openaiweb mapper deixa frete nao exposto fora de oferta final', () => {
  const warning = 'Frete nao exposto pela fonte web; subtotal conhecido.';
  const result = normalizeOpenAiWebCandidates({
    searchRequest,
    payload: {
      candidates: [
        candidate({
          confidence: 'medium',
          shipping: {
            exposed: false,
            amountCents: null,
            currency: null,
            warning
          }
        })
      ]
    }
  });

  assert.equal(result.offers.length, 0);
  assert.equal(result.report.candidatesRejected, 1);
});

test('openaiweb mapper mantem candidato indisponivel fora do ranking', () => {
  const result = normalizeOpenAiWebCandidates({
    searchRequest,
    payload: { candidates: [candidate({ availability: 'out of stock' })] }
  });

  assert.equal(result.offers.length, 0);
  assert.equal(result.report.candidatesRejected, 1);
});
