import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpenAiWebCandidates } from '../src/modules/providers/adapters/openaiSearchMapper.js';

const searchRequest = Object.freeze({
  query: 'Notebook',
  normalizedQuery: 'notebook',
  context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
});

function money(amountCents, field) {
  return {
    amountCents,
    evidenceUrl: `https://example.com/${field}`,
    evidenceText: `${field} informado pela fonte consultada.`
  };
}

function candidate(overrides = {}) {
  return {
    title: 'Notebook com evidencia real',
    sellerName: 'Vendedor informado pela fonte',
    productUrl: 'https://example.com/notebook',
    currency: 'BRL',
    availability: 'available',
    price: money(250000, 'preco'),
    shipping: {
      ...money(1800, 'frete'),
      exposed: true,
      warning: null
    },
    taxes: money(3200, 'imposto'),
    delivery: {
      minDays: 2,
      maxDays: 5,
      evidenceUrl: 'https://example.com/frete',
      evidenceText: 'Prazo informado pela fonte consultada.'
    },
    confidenceLevel: 'high',
    confidenceReasons: ['Campos obrigatorios tinham evidencia.'],
    rejected: false,
    rejectionReason: null,
    ...overrides
  };
}

test('openaiweb mapper descarta candidato com imposto desconhecido', () => {
  const result = normalizeOpenAiWebCandidates({
    searchRequest,
    payload: {
      candidates: [
        candidate({
          taxes: { amountCents: null, evidenceUrl: null, evidenceText: null }
        })
      ]
    }
  });

  assert.equal(result.offers.length, 0);
  assert.equal(result.report.candidatesExtracted, 1);
  assert.equal(result.report.candidatesRejected, 1);
});

test('openaiweb mapper aceita frete nao exposto apenas com aviso claro', () => {
  const warning = 'Frete nao exposto pela fonte web; subtotal conhecido.';
  const result = normalizeOpenAiWebCandidates({
    searchRequest,
    payload: {
      candidates: [
        candidate({
          confidenceLevel: 'medium',
          shipping: {
            amountCents: null,
            exposed: false,
            evidenceUrl: null,
            evidenceText: null,
            warning
          }
        })
      ]
    }
  });

  assert.equal(result.offers.length, 1);
  assert.deepEqual(result.offers[0].shipping, {
    amountCents: 0,
    currency: 'BRL',
    exposed: false,
    warning
  });
  assert.ok(result.offers[0].warnings.includes(warning));
});

test('openaiweb mapper mantem candidato indisponivel fora do ranking', () => {
  const result = normalizeOpenAiWebCandidates({
    searchRequest,
    payload: { candidates: [candidate({ availability: 'out of stock' })] }
  });

  assert.equal(result.offers.length, 0);
  assert.equal(result.report.candidatesRejected, 1);
});
