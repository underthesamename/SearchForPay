import { renderAlerts } from './alertsRender.js';
import { decodeAlertCandidate } from './alertCandidatePayload.js';

const alertForm = document.querySelector('[data-alert-form]');
const alertList = document.querySelector('[data-alert-list]');
const alertStatus = document.querySelector('[data-alert-status]');
const refreshButton = document.querySelector('[data-refresh-alerts]');
let selectedCandidate = null;

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

function selectCandidateForAlert(candidate) {
  selectedCandidate = candidate;
  alertForm.dataset.sourceType = 'candidate';
  setAlertStatus(`Candidato selecionado: ${candidate.productTitle || candidate.productUrl}. Informe o alvo.`, 'ok');
  alertForm.elements.namedItem('targetTotal')?.focus();
}

function clearSelectedCandidate() {
  selectedCandidate = null;
  delete alertForm.dataset.sourceType;
}

function publicErrorMessage(error) {
  return error?.error?.message || 'Nao foi possivel atualizar alertas agora.';
}

async function loadAlerts() {
  const payload = await apiJson('/api/alerts');
  renderAlerts(alertList, payload.alerts || []);
}

function alertPayload(searchForm, targetAmount) {
  return {
    ...searchFromForm(searchForm),
    targetAmountCents: targetAmount,
    candidate: selectedCandidate || undefined
  };
}

export function setupPriceAlerts({ searchForm, isFilePage, setState }) {
  if (isFilePage) {
    alertForm.querySelectorAll('button, input').forEach((field) => {
      field.disabled = true;
    });
    setAlertStatus('Abra http://127.0.0.1:3000/ para usar alertas reais.', 'error');
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
      setState?.('loading', 'Salvando alerta', 'A primeira rechecagem usa OpenAI Web Search antes de ativar o aviso.');
      await apiJson('/api/alerts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(alertPayload(searchForm, targetAmount))
      });
      alertForm.reset();
      clearSelectedCandidate();
      await loadAlerts();
      setAlertStatus('Alerta salvo para revalidacao real.', 'ok');
      setState?.('success', 'Alerta salvo', 'O monitoramento vai avisar somente com evidencia revalidada dentro do alvo.');
    } catch (error) {
      setAlertStatus(publicErrorMessage(error), 'error');
      setState?.('error', 'Alerta nao salvo', publicErrorMessage(error));
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
      setAlertStatus(isDelete ? 'Removendo alerta.' : 'Revalidando pesquisa web.', 'loading');
      if (!isDelete) {
        setState?.('loading', 'Revalidando alerta', 'Reconsultando a web antes de atualizar o status do alvo.');
      }
      await apiJson(`/api/alerts/${encodeURIComponent(id)}${isDelete ? '' : '/check'}`, {
        method: isDelete ? 'DELETE' : 'POST'
      });
      await loadAlerts();
      setAlertStatus(isDelete ? 'Alerta removido.' : 'Alerta revalidado.', 'ok');
      setState?.(isDelete ? 'success' : 'success', isDelete ? 'Alerta removido' : 'Alerta revalidado', 'A lista de alertas foi atualizada.');
    } catch (error) {
      setAlertStatus(publicErrorMessage(error), 'error');
      setState?.('error', 'Alerta nao atualizado', publicErrorMessage(error));
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

  document.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-alert-candidate]') : null;
    const candidate = button ? decodeAlertCandidate(button.dataset.alertCandidate) : null;

    if (candidate) {
      selectCandidateForAlert(candidate);
    }
  });

  loadAlerts().catch((error) => {
    setAlertStatus(publicErrorMessage(error), 'error');
  });
}
