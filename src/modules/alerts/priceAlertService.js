import { toPublicError, NotFoundError } from '../../shared/errors.js';
import { createPriceAlert, toPublicPriceAlert } from './priceAlertModel.js';

function nextRunAt(now, intervalMs) {
  return new Date(now.getTime() + intervalMs).toISOString();
}

function publicBestOffer(offer) {
  if (!offer) {
    return null;
  }

  return {
    providerName: offer.providerName,
    productTitle: offer.productTitle,
    productUrl: offer.productUrl,
    seller: offer.seller,
    totalCost: offer.totalCost,
    price: offer.price,
    shipping: offer.shipping,
    taxes: offer.taxes
  };
}

function successResult(alert, payload, checkedAt) {
  const bestOffer = payload.results?.[0] || null;
  const targetMet = Boolean(
    bestOffer &&
    bestOffer.totalCost?.currency === alert.targetTotalCost.currency &&
    bestOffer.totalCost.amountCents <= alert.targetTotalCost.amountCents
  );

  return {
    status: targetMet ? 'target_met' : 'target_not_met',
    checkedAt,
    message: targetMet
      ? 'Preco alvo atingido por oferta real revalidada.'
      : 'Preco alvo ainda nao foi atingido por oferta real revalidada.',
    bestOffer: publicBestOffer(bestOffer),
    providerReports: payload.meta?.providerReports || []
  };
}

function failedResult(error, checkedAt) {
  const publicError = toPublicError(error);

  return {
    status: 'failed',
    checkedAt,
    message: publicError.message,
    error: {
      code: publicError.code,
      details: publicError.details
    }
  };
}

export function createPriceAlertService({ store, searchService, defaultIntervalMs, now = () => new Date() }) {
  async function recheck(alert) {
    const checkedAt = now();
    const baseUpdate = {
      ...alert,
      updatedAt: checkedAt.toISOString(),
      lastCheckedAt: checkedAt.toISOString(),
      schedule: {
        ...alert.schedule,
        nextRunAt: nextRunAt(checkedAt, alert.schedule.intervalMs)
      }
    };

    try {
      const payload = await searchService.search(alert.search);
      const lastResult = successResult(alert, payload, checkedAt.toISOString());

      return {
        ...baseUpdate,
        lastMatchAt: lastResult.status === 'target_met' ? checkedAt.toISOString() : alert.lastMatchAt,
        lastResult
      };
    } catch (error) {
      return {
        ...baseUpdate,
        lastResult: failedResult(error, checkedAt.toISOString())
      };
    }
  }

  async function getRequiredAlert(id) {
    const alert = await store.getAlert(id);

    if (!alert) {
      throw new NotFoundError('Alerta de preco nao encontrado.');
    }

    return alert;
  }

  return {
    async listAlerts() {
      return (await store.listAlerts()).map(toPublicPriceAlert);
    },

    async createAlert(input) {
      const alert = createPriceAlert(input, { now: now(), defaultIntervalMs });
      await store.saveAlert(alert);
      return toPublicPriceAlert(alert);
    },

    async removeAlert(id) {
      const removed = await store.removeAlert(id);

      if (!removed) {
        throw new NotFoundError('Alerta de preco nao encontrado.');
      }

      return { removed: true };
    },

    async checkAlert(id) {
      const checked = await recheck(await getRequiredAlert(id));
      await store.saveAlert(checked);
      return toPublicPriceAlert(checked);
    },

    async runDueAlerts() {
      const nowTime = now().getTime();
      const alerts = (await store.listAlerts()).filter((alert) => (
        alert.status === 'active' &&
        new Date(alert.schedule.nextRunAt).getTime() <= nowTime
      ));
      const checkedAlerts = [];

      for (const alert of alerts) {
        checkedAlerts.push(await this.checkAlert(alert.id));
      }

      return {
        checked: checkedAlerts.length,
        alerts: checkedAlerts
      };
    }
  };
}
