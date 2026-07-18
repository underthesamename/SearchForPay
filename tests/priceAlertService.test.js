import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceAlertService } from '../src/modules/alerts/priceAlertService.js';
import { ServiceUnavailableError } from '../src/shared/errors.js';

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

function fixedClock(...isoDates) {
  let index = 0;

  return () => new Date(isoDates[Math.min(index++, isoDates.length - 1)]);
}

function evidence() {
  return [{
    url: 'https://example.com/produto-validado',
    title: 'Pagina revalidada',
    snippet: 'Trecho com preco, frete e imposto expostos.',
    accessedAt: '2026-07-18T10:00:00.000Z'
  }];
}

function verifiedOffer(totalAmountCents, overrides = {}) {
  return {
    providerName: 'openaiweb',
    productTitle: 'Produto validado pelo contrato',
    productUrl: 'https://example.com/produto-validado',
    seller: { name: 'Loja validada pelo contrato' },
    storeName: 'Loja validada pelo contrato',
    availability: 'available',
    price: { amountCents: totalAmountCents - 1000, currency: 'BRL' },
    shipping: { amountCents: 1000, currency: 'BRL' },
    taxes: { amountCents: 0, currency: 'BRL' },
    totalCost: { amountCents: totalAmountCents, currency: 'BRL', complete: true },
    costCompleteness: { status: 'complete', complete: true, missingComponents: [], warnings: [] },
    evidence: evidence(),
    verification: { evidence: evidence(), confidenceLevel: 'high' },
    revalidation: {
      status: 'confirmado',
      lastVerifiedAt: '2026-07-18T10:00:00.000Z',
      evidence: evidence()
    },
    ...overrides
  };
}

function searchPayload(totalAmountCents, options = {}) {
  return {
    results: totalAmountCents === null ? [] : [verifiedOffer(totalAmountCents, options.offer)],
    webCandidates: options.webCandidates || [],
    meta: {
      providerReports: [{
        providerName: 'openaiweb',
        status: 'ok',
        validOffers: totalAmountCents === null ? 0 : 1,
        invalidOffers: 0
      }],
      webResearch: { status: 'ok', providerName: 'openaiweb' }
    }
  };
}

test('alerta salva busca e dispara quando reconsulta real atinge o alvo', async () => {
  let receivedRequest;
  const service = createPriceAlertService({
    store: createMemoryStore(),
    defaultIntervalMs: 60_000,
    now: fixedClock('2026-07-18T10:00:00.000Z', '2026-07-18T10:01:00.000Z'),
    searchService: {
      async search(request) {
        receivedRequest = request;
        return searchPayload(11000);
      }
    }
  });

  const created = await service.createAlert({
    query: '  Monitor  ',
    postalCode: '01001-000',
    country: 'br',
    currency: 'brl',
    targetAmountCents: 12000
  });
  const checked = await service.checkAlert(created.id);

  assert.equal(created.context.postalCodeMasked, 'CEP final 000');
  assert.equal('postalCode' in created.context, false);
  assert.equal(created.lastResult.status, 'target_met');
  assert.equal(checked.lastResult.status, 'target_met');
  assert.equal(checked.lastResult.bestOffer.totalCost.amountCents, 11000);
  assert.equal(checked.lastMatchAt, '2026-07-18T10:01:00.000Z');
  assert.deepEqual(receivedRequest, {
    query: 'Monitor',
    normalizedQuery: 'monitor',
    searchMode: 'web_research',
    context: { postalCode: '01001-000', country: 'BR', currency: 'BRL' }
  });
});

test('alerta nao inventa baixa quando melhor oferta real fica acima do alvo', async () => {
  const service = createPriceAlertService({
    store: createMemoryStore(),
    defaultIntervalMs: 60_000,
    now: fixedClock('2026-07-18T10:00:00.000Z', '2026-07-18T10:01:00.000Z'),
    searchService: {
      async search() {
        return searchPayload(15000);
      }
    }
  });

  const created = await service.createAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 12000
  });
  const checked = await service.checkAlert(created.id);

  assert.equal(created.lastResult.status, 'target_not_met');
  assert.equal(checked.lastResult.status, 'target_not_met');
  assert.equal(checked.lastMatchAt, null);
  assert.equal(checked.lastResult.bestOffer.totalCost.amountCents, 15000);
});

test('alerta salva erro claro quando nenhum provedor real esta disponivel', async () => {
  const service = createPriceAlertService({
    store: createMemoryStore(),
    defaultIntervalMs: 60_000,
    now: fixedClock(
      '2026-07-18T10:00:00.000Z',
      '2026-07-18T10:01:00.000Z',
      '2026-07-18T10:02:00.000Z',
      '2026-07-18T10:04:00.000Z',
      '2026-07-18T10:04:00.000Z'
    ),
    searchService: {
      async search() {
        throw new ServiceUnavailableError('OpenAI Web Search nao esta disponivel para buscar produtos.');
      }
    }
  });

  const created = await service.createAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 12000
  });
  const checked = await service.checkAlert(created.id);
  const due = await service.runDueAlerts();

  assert.equal(created.lastResult.status, 'failed');
  assert.equal(checked.lastResult.status, 'failed');
  assert.equal(due.checked, 1);
  assert.equal(due.alerts[0].lastResult.status, 'failed');
  assert.equal(checked.lastResult.error.code, 'SERVICE_UNAVAILABLE');
  assert.match(checked.lastResult.message, /OpenAI Web Search/);
});

test('alerta nao dispara sem evidencia revalidada', async () => {
  const service = createPriceAlertService({
    store: createMemoryStore(),
    defaultIntervalMs: 60_000,
    now: fixedClock('2026-07-18T10:00:00.000Z', '2026-07-18T10:01:00.000Z'),
    searchService: {
      async search() {
        return searchPayload(9000, {
          offer: { evidence: [], verification: { evidence: [] }, revalidation: null }
        });
      }
    }
  });

  const created = await service.createAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 12000
  });

  assert.equal(created.lastResult.status, 'pending');
  assert.equal(created.lastResult.bestOffer, null);
  assert.equal(created.lastMatchAt, null);
});

test('alerta mantem candidato incompleto como pendente', async () => {
  const incompleteCandidate = {
    productTitle: 'Produto incompleto',
    storeName: 'Loja verificavel',
    productUrl: 'https://example.com/produto-validado',
    visiblePrice: { amountCents: 9000, currency: 'BRL' },
    shipping: { exposed: true, amountCents: 1000, currency: 'BRL' },
    taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao confirmado.' },
    evidence: evidence(),
    confidence: 'high',
    availability: 'available',
    costCompleteness: { status: 'incomplete', complete: false, missingComponents: ['taxes'], warnings: [] },
    revalidation: {
      status: 'incompleto',
      lastVerifiedAt: '2026-07-18T10:00:00.000Z',
      evidence: evidence()
    }
  };
  const service = createPriceAlertService({
    store: createMemoryStore(),
    defaultIntervalMs: 60_000,
    now: fixedClock('2026-07-18T10:00:00.000Z', '2026-07-18T10:01:00.000Z'),
    searchService: {
      async search() {
        return searchPayload(null, { webCandidates: [incompleteCandidate] });
      }
    }
  });

  const created = await service.createAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 12000
  });

  assert.equal(created.lastResult.status, 'pending');
  assert.match(created.lastResult.message, /pendente/);
  assert.equal(created.lastMatchAt, null);
});

test('runDueAlerts reconsulta apenas alertas vencidos', async () => {
  let calls = 0;
  const service = createPriceAlertService({
    store: createMemoryStore(),
    defaultIntervalMs: 60_000,
    now: fixedClock(
      '2026-07-18T10:00:00.000Z',
      '2026-07-18T10:00:00.000Z',
      '2026-07-18T10:02:00.000Z',
      '2026-07-18T10:02:00.000Z'
    ),
    searchService: {
      async search() {
        calls += 1;
        return searchPayload(null);
      }
    }
  });

  await service.createAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 12000
  });
  calls = 0;

  const result = await service.runDueAlerts();

  assert.equal(result.checked, 1);
  assert.equal(calls, 1);
  assert.equal(result.alerts[0].lastResult.status, 'pending');
});
