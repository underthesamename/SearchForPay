import { renderOffer, renderProviderReports, renderSkeletonCards } from './compareRender.js';
import { renderWebCandidates } from './webCandidatesRender.js';

const results = document.querySelector('[data-results]');
const webCandidates = document.querySelector('[data-web-candidates]');
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
  if (typeof enabledCount === 'object' && enabledCount?.mode === 'web_research') {
    healthBadge.textContent = enabledCount.openAiEnabled ? 'Web Search ativo' : 'Web Search inativo';
    healthBadge.dataset.status = enabledCount.openAiEnabled ? 'ok' : 'warn';
    return;
  }

  if (enabledCount === null) {
    healthBadge.textContent = 'Offline';
    healthBadge.dataset.status = 'error';
    return;
  }

  healthBadge.textContent = enabledCount ? `${enabledCount} provedores legados ativos` : 'Sem provedor legado ativo';
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
  buttonLabel.textContent = isLoading ? 'Pesquisando' : 'Pesquisar na web';
}

export function clearResults() {
  results.replaceChildren();
  webCandidates.replaceChildren();
  providerReport.replaceChildren();
  resultCount.textContent = '';
}

export function renderLoading() {
  clearResults();
  delete mainPanel.dataset.mode;
  resultCount.textContent = 'Pesquisando';
  renderSkeletonCards(results, providerReport);
  setComparisonVisible(true);
}

function reportsFromMeta(meta = {}) {
  return [
    ...(meta.providerReports || []),
    ...(meta.webResearch ? [meta.webResearch] : [])
  ];
}

export function renderResults(payload) {
  clearResults();
  delete mainPanel.dataset.mode;
  const offers = (payload.results || []).slice(0, 3);
  const candidates = payload.webCandidates || [];
  renderProviderReports(providerReport, reportsFromMeta(payload.meta));
  renderWebCandidates(webCandidates, candidates);
  setComparisonVisible(true);

  if (!offers.length) {
    resultCount.textContent = candidates.length ? '0 ofertas validas' : '';
    setState(
      candidates.length ? 'warning' : 'empty',
      candidates.length ? 'Candidatos incompletos' : 'Sem candidatos verificaveis',
      candidates.length
        ? 'A busca achou candidatos na web, mas eles ainda precisam de custo completo ou confirmacao.'
        : 'A pesquisa terminou sem fonte HTTPS com preco visivel e evidencia suficiente.'
    );
    return;
  }

  resultCount.textContent = `${offers.length} resultado(s)`;
  results.append(...offers.map(renderOffer));
  setState('success', 'Ofertas completas', stateMessageForSuccess(payload, candidates));
}

function stateMessageForSuccess(payload, candidates) {
  if (payload.meta?.rankingSource === 'openai_web_search') {
    return 'O ranking usa ofertas completas verificadas por pesquisa web. Confirme no site antes de comprar.';
  }

  if (candidates.length) {
    return 'Resultados legados ficam no ranking; candidatos web aparecem separados para conferencia.';
  }

  return 'Produto, frete e imposto vieram de fonte legada configurada.';
}

export function renderSearchError(payload) {
  clearResults();
  const reports = [
    ...(payload.error?.details?.providers || []),
    ...(payload.error?.details?.webResearch ? [payload.error.details.webResearch] : [])
  ];
  renderProviderReports(providerReport, reports);
  mainPanel.dataset.mode = reports.length > 0 ? 'report' : 'empty';
  setComparisonVisible(reports.length > 0);
  setState('error', 'Busca nao concluida', errorMessage(payload, reports));
}

function errorMessage(payload, reports) {
  const message = payload.error?.message || 'Nao foi possivel buscar ofertas agora.';

  if (payload.error?.code === 'SERVICE_UNAVAILABLE' && hasRateLimitReport(reports)) {
    return `${firstReportMessage(reports) || message} Aguarde alguns minutos ou revise os limites/billing da OpenAI antes de tentar novamente.`;
  }

  if (payload.error?.code === 'SERVICE_UNAVAILABLE') {
    return `${message} Ative a pesquisa web e configure a chave OpenAI no ambiente do servidor.`;
  }

  return message;
}

function firstReportMessage(reports) {
  return reports
    .map((report) => String(report?.message || '').trim())
    .find(Boolean);
}

function hasRateLimitReport(reports) {
  return /limite|rate limit|429/i.test(JSON.stringify(reports));
}
