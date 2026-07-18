import { el, formatMoney } from './dom.js';

function appendBreakdown(parent, totalCost) {
  const list = el('dl', 'breakdown');
  const rows = [
    ['Produto', totalCost.breakdown?.product],
    ['Frete', totalCost.breakdown?.shipping],
    ['Imposto', totalCost.breakdown?.taxes],
    ['Total', totalCost]
  ];

  for (const [label, money] of rows) {
    const row = el('div', label === 'Total' ? 'breakdown-row total-row' : 'breakdown-row');
    row.append(el('dt', '', label), el('dd', '', formatMoney(money)));
    list.append(row);
  }

  parent.append(list);
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
  totalBlock.append(el('strong', 'total-price', formatMoney(offer.totalCost)), el('span', 'total-label', 'custo total'));
  body.append(el('h3', '', offer.productTitle), el('p', 'meta', meta));
  appendBreakdown(body, offer.totalCost);

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
    return `${report.validOffers} validas / ${report.invalidOffers} ignoradas`;
  }

  return report.message || 'Falha ao consultar provedor.';
}
