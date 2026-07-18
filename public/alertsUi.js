import { renderAlerts } from './alertsRender.js';

const alertForm = document.querySelector('[data-alert-form]');
const alertList = document.querySelector('[data-alert-list]');
const alertStatus = document.querySelector('[data-alert-status]');
const refreshButton = document.querySelector('[data-refresh-alerts]');

function formValue(form, name) {
  return String(form.elements.namedItem(name)?.value || '').trim();
}

function searchFromForm(form) {
  return {
    query: formValue(form, 'query'),
    postalCode: formValue(form, 'postalCode'),
    country: formValue(form, 'country').toUpperCase(),
    currency: formValue(form, 'currency').toUpperCase()
  };
}

function targetAmountCents(value) {
  const raw = String(value || '').trim();
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return Math.round(parsed * 100);
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw payload;
  }

  return payload;
}

function setAlertStatus(message, kind = 'idle') {
  alertStatus.textContent = message;
  alertStatus.dataset.status = kind;
}

function publicErrorMessage(error) {
  return error?.error?.message || 'Nao foi possivel atualizar alertas agora.';
}

async function loadAlerts() {
  const payload = await apiJson('/api/alerts');
  renderAlerts(alertList, payload.alerts || []);
}

export function setupPriceAlerts({ searchForm, isFilePage }) {
  if (isFilePage) {
    alertForm.querySelectorAll('button, input').forEach((field) => {
      field.disabled = true;
    });
    setAlertStatus('Abra http://127.0.0.1:3001/ para usar alertas reais.', 'error');
    return;
  }

  alertForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const targetAmount = targetAmountCents(formValue(alertForm, 'targetTotal'));

    if (!targetAmount) {
      setAlertStatus('Informe um custo total alvo valido.', 'error');
      return;
    }

    try {
      setAlertStatus('Salvando alerta.', 'loading');
      await apiJson('/api/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...searchFromForm(searchForm),
          targetAmountCents: targetAmount
        })
      });
      alertForm.reset();
      await loadAlerts();
      setAlertStatus('Alerta salvo para revalidacao real.', 'ok');
    } catch (error) {
      setAlertStatus(publicErrorMessage(error), 'error');
    }
  });

  alertList.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-alert-action]') : null;

    if (!button) {
      return;
    }

    const id = button.dataset.alertId;
    const isDelete = button.dataset.alertAction === 'delete';

    try {
      setAlertStatus(isDelete ? 'Removendo alerta.' : 'Revalidando provedores reais.', 'loading');
      await apiJson(`/api/alerts/${encodeURIComponent(id)}${isDelete ? '' : '/check'}`, {
        method: isDelete ? 'DELETE' : 'POST'
      });
      await loadAlerts();
      setAlertStatus(isDelete ? 'Alerta removido.' : 'Alerta revalidado.', 'ok');
    } catch (error) {
      setAlertStatus(publicErrorMessage(error), 'error');
    }
  });

  refreshButton.addEventListener('click', async () => {
    try {
      await loadAlerts();
      setAlertStatus('Alertas atualizados.', 'ok');
    } catch (error) {
      setAlertStatus(publicErrorMessage(error), 'error');
    }
  });

  loadAlerts().catch((error) => {
    setAlertStatus(publicErrorMessage(error), 'error');
  });
}
