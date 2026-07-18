import { renderOffer, renderProviderReports, renderSkeletonCards } from './compareRender.js';

const results = document.querySelector('[data-results]');
const mainPanel = document.querySelector('[data-main]');
const resultCount = document.querySelector('[data-result-count]');
const providerReport = document.querySelector('[data-provider-report]');
const statePanel = document.querySelector('[data-state]');
const stateTitle = document.querySelector('[data-state-title]');
const stateMessage = document.querySelector('[data-state-message]');
const healthBadge = document.querySelector('[data-health]');
const button = document.querySelector('[data-search-form] button');
const buttonLabel = document.querySelector('[data-button-label]');

export function setHealth(enabledCount) {
  if (enabledCount === null) {
    healthBadge.textContent = 'Offline';
    healthBadge.dataset.status = 'error';
    return;
  }

  healthBadge.textContent = enabledCount ? `${enabledCount} provedores ativos` : 'Sem provedor ativo';
  healthBadge.dataset.status = enabledCount ? 'ok' : 'warn';
}

export function setState(kind, title, message) {
  statePanel.dataset.stateKind = kind;
  statePanel.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  mainPanel.setAttribute('aria-busy', String(kind === 'loading'));
  stateTitle.textContent = title;
  stateMessage.textContent = message;
  document.body.dataset.loading = kind === 'loading' ? 'true' : 'false';

  if (kind === 'error') {
    statePanel.focus({ preventScroll: false });
  }
}

export function setComparisonVisible(isVisible) {
  mainPanel.hidden = !isVisible;
}

export function setLoading(isLoading) {
  button.disabled = isLoading;
  button.setAttribute('aria-disabled', String(isLoading));
  buttonLabel.textContent = isLoading ? 'Buscando' : 'Buscar ofertas';
}

export function clearResults() {
  results.replaceChildren();
  providerReport.replaceChildren();
  resultCount.textContent = '';
}

export function renderLoading() {
  clearResults();
  resultCount.textContent = 'Consultando';
  renderSkeletonCards(results, providerReport);
  setComparisonVisible(true);
}

export function renderResults(payload) {
  clearResults();
  const offers = (payload.results || []).slice(0, 3);
  renderProviderReports(providerReport, payload.meta?.providerReports || []);
  setComparisonVisible(true);

  if (!offers.length) {
    setState('empty', 'Nenhuma oferta valida', 'Os provedores responderam, mas nenhuma oferta completa entrou no ranking.');
    return;
  }

  resultCount.textContent = `${offers.length} resultado(s)`;
  results.append(...offers.map(renderOffer));
  setState('success', 'Ranking atualizado', 'Produto, frete e imposto vieram dos provedores reais.');
}

export function renderSearchError(payload) {
  clearResults();
  const reports = payload.error?.details?.providers || [];
  renderProviderReports(providerReport, reports);
  setComparisonVisible(reports.length > 0);
  setState('error', 'Busca nao concluida', errorMessage(payload, reports));
}

function errorMessage(payload, reports) {
  const message = payload.error?.message || 'Nao foi possivel buscar ofertas agora.';

  if (payload.error?.code === 'SERVICE_UNAVAILABLE' && reports.length === 0) {
    return `${message} Configure ao menos um provedor real no ambiente.`;
  }

  return message;
}
