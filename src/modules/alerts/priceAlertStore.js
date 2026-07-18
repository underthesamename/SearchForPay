import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ConfigurationError } from '../../shared/errors.js';
import { normalizePriceAlert } from './priceAlertModel.js';

const DEFAULT_FILE = '.searchforpay/price-alerts.json';

function resolveStoreFile(filePath) {
  return resolve(filePath || DEFAULT_FILE);
}

function storeEnvelope(alerts) {
  return {
    model: 'PriceAlertStore',
    version: 1,
    alerts
  };
}

function alertRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.alerts)) {
    return payload.alerts;
  }

  return [];
}

export function createPriceAlertStore(options = {}) {
  const filePath = resolveStoreFile(options.filePath);
  let writeQueue = Promise.resolve();

  async function readAlerts() {
    try {
      const raw = await readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return alertRecords(parsed).map((alert) => normalizePriceAlert(alert));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }

      if (error instanceof SyntaxError) {
        throw new ConfigurationError('Arquivo local de alertas esta invalido.');
      }

      throw error;
    }
  }

  async function writeAlerts(alerts) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(storeEnvelope(alerts), null, 2)}\n`, 'utf8');
  }

  async function mutateAlerts(mutator) {
    writeQueue = writeQueue.then(async () => {
      const alerts = await readAlerts();
      const nextAlerts = await mutator(alerts);
      await writeAlerts(nextAlerts);
      return nextAlerts;
    });

    return writeQueue;
  }

  async function listAlerts() {
    return readAlerts();
  }

  async function getAlert(id) {
    return (await readAlerts()).find((alert) => alert.id === id);
  }

  async function saveAlert(alert) {
    const normalized = normalizePriceAlert(alert);
    await mutateAlerts((alerts) => [
      normalized,
      ...alerts.filter((item) => item.id !== normalized.id)
    ]);
    return normalized;
  }

  async function removeAlert(id) {
    let removed = false;
    await mutateAlerts((alerts) => {
      const nextAlerts = alerts.filter((alert) => alert.id !== id);
      removed = nextAlerts.length !== alerts.length;
      return nextAlerts;
    });
    return removed;
  }

  return {
    filePath,
    listAlerts,
    getAlert,
    saveAlert,
    removeAlert
  };
}
