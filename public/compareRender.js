import { el, formatMoney } from './dom.js';

function appendBreakdown(parent, totalCost) {
  const list = el('dl', 'breakdown');
  const totalLabel = totalCost.complete === false ? 'Subtotal conhecido' : 'Total';
  const rows = [
    ['Produto', totalCost.breakdown?.product],
    ['Frete', totalCost.breakdown?.shipping],
    ['Imposto', totalCost.breakdown?.taxes],
    [totalLabel, totalCost]
  ];

  for (const [label, money] of rows) {
    const row = el('div', label === totalLabel ? 'breakdown-row total-row' : 'breakdown-row');
    const value = money?.exposed === false ? 'Sem frete exposto' : formatMoney(money);
    row.append(el('dt', '', label), el('dd', '', value));
    list.append(row);
  }

  parent.append(list);
}

function uniqueWarnings(offer) {
  return [...new Set([
    ...(offer.warnings || []),
    ...(offer.totalCost?.warnings || [])
  ].filter(Boolean))];
}

function confidenceText(offer) {
  const level = offer.verification?.confidenceLevel;

  if (!level) {
    return '';
  }

  const label = level === 'high' ? 'alta' : level === 'medium' ? 'media' : 'baixa';
  const evidenceCount = Array.isArray(offer.verification.evidence) ? offer.verification.evidence.length : 0;
  return `Confianca ${label}: ${evidenceCount} evidencia(s) verificadas antes do ranking.`;
}

export function renderOffer(offer, index) {
  const card = el('article', 'result-card');
  const body = el('div', 'offer-body');
  const meta = [offer.seller?.name, offer.providerName, offer.source?.name].filter(Boolean).join(' / ');
  const totalBlock = el('div', 'total-block');
  const link = el('a', 'offer-link', 'Abrir oferta real');

  link.href = offer.productUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Abrir oferta real: ${offer.productTitle}`);
  totalBlock.append(
    el('strong', 'total-price', formatMoney(offer.totalCost)),
    el('span', 'total-label', offer.totalCost?.complete === false ? 'subtotal conhecido' : 'custo total')
  );
  body.append(el('h3', '', offer.productTitle), el('p', 'meta', meta));
  appendBreakdown(body, offer.totalCost);

  for (const warning of uniqueWarnings(offer)) {
    body.append(el('p', 'warning-line', warning));
  }

  if (confidenceText(offer)) {
    body.append(el('p', 'confidence-line', confidenceText(offer)));
  }

  if (offer.ranking?.criteria?.delivery) {
    body.append(el('p', 'meta', `Prazo: ${offer.ranking.criteria.delivery}`));
  }

  if (offer.ranking?.explanation) {
    body.append(el('p', 'explanation', offer.ranking.explanation));
  }

  body.append(link);
  card.append(el('div', 'rank', String(index + 1)), body, totalBlock);
  return card;
}

export function renderSkeletonCards(results, providerReport) {
  for (let index = 0; index < 3; index += 1) {
    const card = el('article', 'result-card skeleton-card');
    const lines = el('div', 'skeleton-lines');
    card.setAttribute('aria-hidden', 'true');
    lines.append(el('span', 'skeleton-line wide'), el('span', 'skeleton-line'), el('span', 'skeleton-line short'));
    card.append(el('div', 'rank skeleton-dot'), lines, el('div', 'skeleton-total'));
    results.append(card);
  }

  providerReport.append(el('p', 'muted-line', 'Consultando provedores configurados.'));
}

export function renderProviderReports(providerReport, reports = []) {
  if (!reports.length) {
    providerReport.append(el('p', 'muted-line', 'Nenhum relatorio retornado pela API.'));
    return;
  }

  for (const report of reports) {
    const item = el('div', 'provider-item');
    item.dataset.status = report.status;
    item.append(el('strong', '', report.providerName), el('span', '', providerSummary(report)));
    providerReport.append(item);
  }
}

function providerSummary(report) {
  if (report.status === 'ok') {
    const summary = `${report.validOffers} validas / ${report.invalidOffers} ignoradas`;

    if (Number.isInteger(report.candidatesExtracted)) {
      return `${summary} / ${report.candidatesExtracted} candidatos web`;
    }

    return summary;
  }

  return report.message || 'Falha ao consultar provedor.';
}
