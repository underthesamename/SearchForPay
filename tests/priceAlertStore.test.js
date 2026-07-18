import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPriceAlert } from '../src/modules/alerts/priceAlertModel.js';
import { createPriceAlertStore } from '../src/modules/alerts/priceAlertStore.js';

test('store local persiste busca e preco alvo para revalidacao futura', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'searchforpay-alerts-'));
  const filePath = join(directory, 'price-alerts.json');

  t.after(() => rm(directory, { recursive: true, force: true }));

  const alert = createPriceAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 12000
  }, {
    id: 'alerta-contrato',
    now: new Date('2026-07-18T10:00:00.000Z'),
    defaultIntervalMs: 60_000
  });

  await createPriceAlertStore({ filePath }).saveAlert(alert);

  const loaded = await createPriceAlertStore({ filePath }).listAlerts();

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'alerta-contrato');
  assert.equal(loaded[0].search.context.postalCode, '01001000');
  assert.equal(loaded[0].targetTotalCost.amountCents, 12000);
});

test('store local persiste candidato do alerta com URL e evidencia', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'searchforpay-alert-candidate-'));
  const filePath = join(directory, 'price-alerts.json');

  t.after(() => rm(directory, { recursive: true, force: true }));

  const alert = createPriceAlert({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    targetAmountCents: 12000,
    candidate: {
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
      }]
    }
  }, {
    id: 'alerta-candidato',
    now: new Date('2026-07-18T10:00:00.000Z'),
    defaultIntervalMs: 60_000
  });

  await createPriceAlertStore({ filePath }).saveAlert(alert);

  const loaded = await createPriceAlertStore({ filePath }).listAlerts();

  assert.equal(loaded[0].sourceType, 'candidate');
  assert.equal(loaded[0].candidateTarget.productUrl, 'https://example.com/monitor');
  assert.equal(loaded[0].candidateTarget.evidence[0].url, 'https://example.com/monitor');
});
