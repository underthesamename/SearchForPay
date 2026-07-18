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
