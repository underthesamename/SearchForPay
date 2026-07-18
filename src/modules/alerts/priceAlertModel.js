import { randomUUID } from 'node:crypto';
import { ValidationError } from '../../shared/errors.js';
import { normalizeCurrencyCode } from '../../shared/validation.js';
import { createSearchRequest } from '../search/searchModels.js';

export const PRICE_ALERT_MODEL = Object.freeze({
  name: 'PriceAlert',
  version: 1,
  requiredFields: Object.freeze([
    'id',
    'search.query',
    'search.context.postalCode',
    'targetTotalCost.amountCents',
    'targetTotalCost.currency',
    'schedule.intervalMs',
    'schedule.nextRunAt'
  ])
});

const DEFAULT_RECHECK_INTERVAL_MS = 60 * 60 * 1000;

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function dateIso(value, fallback) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function positiveInteger(value, fieldName) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(value || '', 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} precisa ser um inteiro positivo.`);
  }

  return parsed;
}

function targetAmountCents(input) {
  return positiveInteger(
    input.targetAmountCents ?? input.targetTotalCostCents ?? input.targetPriceCents,
    'Preco alvo em centavos'
  );
}

function normalizeSchedule(input = {}, now, defaultIntervalMs) {
  const intervalMs = positiveInteger(
    input.intervalMs || defaultIntervalMs || DEFAULT_RECHECK_INTERVAL_MS,
    'Intervalo do alerta'
  );

  return {
    intervalMs,
    nextRunAt: dateIso(input.nextRunAt, now)
  };
}

export function maskPostalCode(postalCode) {
  const normalized = String(postalCode || '').replace(/\s+/g, '');
  return normalized.length > 3 ? `CEP final ${normalized.slice(-3)}` : 'CEP salvo';
}

export function normalizePriceAlert(input = {}, options = {}) {
  if (!isPlainObject(input)) {
    throw new ValidationError('Alerta de preco invalido.');
  }

  const now = options.now || new Date();
  const search = createSearchRequest(input.search || input);
  const targetCurrency = normalizeCurrencyCode(
    input.targetCurrency || input.targetTotalCost?.currency || search.context.currency
  );

  if (targetCurrency !== search.context.currency) {
    throw new ValidationError('Moeda do preco alvo precisa ser igual a moeda da busca.');
  }

  const createdAt = dateIso(input.createdAt, now);
  const updatedAt = dateIso(input.updatedAt, now);

  return {
    id: String(input.id || options.id || randomUUID()),
    model: PRICE_ALERT_MODEL.name,
    modelVersion: PRICE_ALERT_MODEL.version,
    status: input.status === 'paused' ? 'paused' : 'active',
    search,
    targetTotalCost: {
      amountCents: targetAmountCents({
        ...input,
        targetAmountCents: input.targetTotalCost?.amountCents ?? input.targetAmountCents
      }),
      currency: targetCurrency
    },
    schedule: normalizeSchedule(input.schedule, now, options.defaultIntervalMs),
    createdAt,
    updatedAt,
    lastCheckedAt: input.lastCheckedAt || null,
    lastMatchAt: input.lastMatchAt || null,
    lastResult: isPlainObject(input.lastResult) ? input.lastResult : null
  };
}

export function createPriceAlert(input = {}, options = {}) {
  return normalizePriceAlert({
    ...input,
    createdAt: options.now?.toISOString(),
    updatedAt: options.now?.toISOString()
  }, options);
}

export function toPublicPriceAlert(alert) {
  return {
    id: alert.id,
    status: alert.status,
    query: alert.search.query,
    normalizedQuery: alert.search.normalizedQuery,
    context: {
      country: alert.search.context.country,
      currency: alert.search.context.currency,
      postalCodeMasked: maskPostalCode(alert.search.context.postalCode)
    },
    targetTotalCost: alert.targetTotalCost,
    schedule: alert.schedule,
    createdAt: alert.createdAt,
    updatedAt: alert.updatedAt,
    lastCheckedAt: alert.lastCheckedAt,
    lastMatchAt: alert.lastMatchAt,
    lastResult: alert.lastResult
  };
}
