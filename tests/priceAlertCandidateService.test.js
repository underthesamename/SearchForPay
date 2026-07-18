import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceAlertService } from '../src/modules/alerts/priceAlertService.js';

function createMemoryStore() {
  let alerts = [];

  return {
    async listAlerts() {
      return alerts;
    },

    async getAlert(id) {
      return alerts.find((alert) => alert.id === id);
    },

    async saveAlert(alert) {
      alerts = [alert, ...alerts.filter((item) => item.id !== alert.id)];
      return alert;
    },

    async removeAlert(id) {
      const nextAlerts = alerts.filter((alert) => alert.id !== id);
      const removed = nextAlerts.length !== alerts.length;
      alerts = nextAlerts;
      return removed;
    }
  };
}

function candidate(overrides = {}) {
  return {
    productTitle: 'Monitor revalidavel',
    storeName: 'Loja verificavel',
    productUrl: 'https://example.com/monitor',
    visiblePrice: { amountCents: 9000, currency: 'BRL' },
    shipping: { exposed: true, amountCents: 1000, currency: 'BRL' },
    taxes: { exposed: true, amountCents: 500, currency: 'BRL' },
    evidence: [{
      url: 'https://example.com/monitor',
      title: 'Pagina do monitor',
      snippet: 'Trecho com preco e custo expostos.',
      accessedAt: '2026-07-18T10:00:00.000Z'
    }],
    confidence: 'high',
    availability: 'available',
    warnings: [],
    ...overrides
  };
}

test('alerta por candidato revalida URL e dispara apenas com evidencia atual', async () => {
  let received;
  const service = createPriceAlertService({
    store: createMemoryStore(),
    defaultIntervalMs: 60_000,
    now: () => new Date('2026-07-18T10:00:00.000Z'),
    searchService: {
      async search() {
        throw new Error('Busca generica nao deve rodar para alerta por candidato.');
      }
    },
    candidateRevalidationService: {
      async revalidate(input) {
        received = input;
        return {
          status: 'confirmado',
          productUrl: input.candidate.productUrl,
          lastVerifiedAt: '2026-07-18T10:05:00.000Z',
          previous: input.candidate,
          currentCandidate: candidate(),
          comparisons: {},
          evidence: candidate().evidence,
          warnings: []
        };
      }
    }
  });

  const created = await service.createAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 11000,
    candidate: candidate()
  });

  assert.equal(received.candidate.productUrl, 'https://example.com/monitor');
  assert.equal(created.sourceType, 'candidate');
  assert.equal(created.candidateTarget.productUrl, 'https://example.com/monitor');
  assert.equal(created.lastResult.status, 'target_met');
  assert.equal(created.lastResult.bestOffer.totalCost.amountCents, 10500);
  assert.equal(created.lastResult.evidence[0].url, 'https://example.com/monitor');
});
