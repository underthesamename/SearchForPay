import { NotFoundError, ServiceUnavailableError } from '../../shared/errors.js';
import { createPriceAlert, toPublicPriceAlert } from './priceAlertModel.js';
import {
  failedResult,
  resultFromCandidateRevalidation,
  resultFromSearchPayload
} from './priceAlertEvaluation.js';

function nextRunAt(now, intervalMs) {
  return new Date(now.getTime() + intervalMs).toISOString();
}

export function createPriceAlertService({
  store,
  searchService,
  candidateRevalidationService,
  defaultIntervalMs,
  now = () => new Date()
}) {
  async function checkCandidate(alert, checkedAt) {
    if (!candidateRevalidationService) {
      throw new ServiceUnavailableError('Revalidacao OpenAI Web Search para candidato nao esta configurada.');
    }

    const revalidation = await candidateRevalidationService.revalidate({
      candidate: alert.candidateTarget,
      query: alert.search.query,
      context: alert.search.context
    });

    return resultFromCandidateRevalidation(alert, revalidation, checkedAt);
  }

  async function checkSearch(alert, checkedAt) {
    if (!searchService) {
      throw new ServiceUnavailableError('OpenAI Web Search nao esta configurada para rechecagem de alerta.');
    }

    return resultFromSearchPayload(alert, await searchService.search(alert.search), checkedAt);
  }

  async function recheck(alert) {
    const checkedAt = now();
    const checkedAtIso = checkedAt.toISOString();
    const baseUpdate = {
      ...alert,
      updatedAt: checkedAtIso,
      lastCheckedAt: checkedAtIso,
      schedule: {
        ...alert.schedule,
        nextRunAt: nextRunAt(checkedAt, alert.schedule.intervalMs)
      }
    };

    try {
      const lastResult = alert.candidateTarget
        ? await checkCandidate(alert, checkedAtIso)
        : await checkSearch(alert, checkedAtIso);
      const lastVerification = lastResult.lastVerification ?? alert.lastVerification;

      return {
        ...baseUpdate,
        lastVerification,
        lastMatchAt: lastResult.status === 'target_met' ? checkedAt.toISOString() : alert.lastMatchAt,
        lastResult
      };
    } catch (error) {
      return {
        ...baseUpdate,
        lastResult: failedResult(error, checkedAtIso)
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
      const checked = await recheck(alert);
      await store.saveAlert(checked);
      return toPublicPriceAlert(checked);
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
