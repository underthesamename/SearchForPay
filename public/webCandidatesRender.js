import { el, formatMoney } from './dom.js';
import { encodeAlertCandidate } from './alertCandidatePayload.js';

function candidateCost(label, cost, hiddenLabel) {
  const row = el('div', 'candidate-cost-row');
  const value = cost?.exposed === false ? hiddenLabel : formatMoney(cost);
  row.dataset.status = cost?.exposed === false ? 'missing' : 'ok';
  row.append(el('span', '', label), el('strong', '', value));
  return row;
}

function knownSubtotal(candidate) {
  const values = [candidate.visiblePrice, candidate.shipping, candidate.taxes]
    .filter((item) => item?.exposed !== false && Number.isInteger(item?.amountCents) && item.currency);

  if (!values.length || new Set(values.map((item) => item.currency)).size !== 1) return null;

  return {
    amountCents: values.reduce((sum, item) => sum + item.amountCents, 0),
    currency: values[0].currency
  };
}

function statusChip(kind, text) {
  const chip = el('span', 'candidate-chip', text);
  chip.dataset.kind = kind;
  return chip;
}

const GROUPS = Object.freeze([
  {
    key: 'ofertas_completas',
    title: 'Ofertas completas',
    description: 'Candidatos com preco, frete e imposto expostos. O ranking principal usa custo total, nao preco isolado.'
  },
  {
    key: 'custo_incompleto',
    title: 'Candidatos com custo incompleto',
    description: 'Preco visivel encontrado, mas frete ou imposto precisam ser confirmados antes de comparar custo total.'
  },
  {
    key: 'candidatos_fracos',
    title: 'Candidatos fracos',
    description: 'Evidencia, confianca, disponibilidade ou compatibilidade ficaram abaixo do necessario.'
  }
]);

function fallbackGroup(candidate) {
  if (candidate.costCompleteness?.complete === true) return 'ofertas_completas';
  if (candidate.confidence === 'low' || candidate.costCompleteness?.status === 'unavailable') return 'candidatos_fracos';
  return 'custo_incompleto';
}

function groupCandidates(candidates) {
  return GROUPS
    .map((group) => ({
      ...group,
      candidates: candidates.filter((candidate) => (candidate.ranking?.group || fallbackGroup(candidate)) === group.key)
    }))
    .filter((group) => group.candidates.length > 0);
}

function appendEvidenceLinks(parent, evidence = []) {
  const list = el('ul', 'evidence-list');

  for (const item of evidence) {
    const link = el('a', '', item.title || item.url);
    const entry = el('li');
    link.href = item.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    entry.append(link, el('span', '', item.snippet || 'Fonte consultada.'));
    list.append(entry);
  }

  parent.append(list);
}

function appendWarnings(parent, candidate) {
  for (const warning of candidate.researchStatus?.warnings || candidate.warnings || []) {
    parent.append(el('p', 'warning-line', warning));
  }
}

function verificationText(candidate) {
  const checkedAt = candidate.revalidation?.lastVerifiedAt || candidate.lastVerifiedAt;
  return checkedAt
    ? `Ultima verificacao: ${candidate.revalidation?.status || 'revalidado'} em ${new Date(checkedAt).toLocaleString('pt-BR')}.`
    : 'Ultima verificacao: pendente.';
}

function actionRow(candidate, link) {
  const row = el('div', 'item-actions');
  const revalidateButton = el('button', 'quiet-button', 'Revalidar');
  const alertButton = el('button', 'quiet-button', 'Criar alerta');

  revalidateButton.type = 'button';
  revalidateButton.dataset.revalidateCandidate = encodeAlertCandidate(candidate);
  revalidateButton.setAttribute('aria-label', `Revalidar candidato: ${candidate.productTitle}`);
  alertButton.type = 'button';
  alertButton.dataset.alertCandidate = encodeAlertCandidate(candidate);
  alertButton.setAttribute('aria-label', `Criar alerta para candidato: ${candidate.productTitle}`);
  row.append(link, revalidateButton, alertButton);
  return row;
}

export function renderWebCandidate(candidate, index) {
  const card = el('article', 'web-candidate-card');
  const body = el('div', 'offer-body');
  const cost = el('div', 'candidate-cost-grid');
  const link = el('a', 'candidate-link', 'Abrir fonte');
  const chips = el('div', 'candidate-chips');
  const position = candidate.ranking?.position || index + 1;
  const subtotal = knownSubtotal(candidate);
  const totalLabel = candidate.costCompleteness?.complete === true ? 'Total' : 'Subtotal conhecido';

  card.dataset.group = candidate.ranking?.group || fallbackGroup(candidate);
  link.href = candidate.productUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `Abrir fonte do candidato: ${candidate.productTitle}`);
  chips.append(
    statusChip('web', candidate.ranking?.group === 'ofertas_completas' ? 'Oferta completa' : 'Candidato encontrado na web'),
    statusChip('check', 'Precisa confirmacao no site da loja'),
    candidate.shipping?.exposed === false ? statusChip('warn', 'Frete nao exposto') : statusChip('ok', 'Frete exposto'),
    candidate.taxes?.exposed === false ? statusChip('warn', 'Imposto nao exposto') : statusChip('ok', 'Imposto exposto')
  );
  cost.append(
    candidateCost('Preco visivel', candidate.visiblePrice, 'Preco nao informado'),
    candidateCost('Frete', candidate.shipping, 'Frete nao exposto'),
    candidateCost('Imposto', candidate.taxes, 'Imposto nao exposto'),
    candidateCost(totalLabel, subtotal || { exposed: false }, 'Custo total incompleto')
  );
  body.append(chips, el('h3', '', candidate.productTitle), el('p', 'meta', candidate.storeName), cost);
  appendWarnings(body, candidate);
  body.append(el('p', 'meta', `Confianca da pesquisa: ${candidate.confidence}`));
  body.append(el('p', 'meta', verificationText(candidate)));
  if (candidate.ranking?.explanation) {
    body.append(el('p', 'explanation', candidate.ranking.explanation));
  }
  appendEvidenceLinks(body, candidate.evidence || []);
  body.append(actionRow(candidate, link));
  card.append(el('div', 'rank candidate-rank', String(position)), body);
  return card;
}

export function renderWebCandidates(container, candidates = []) {
  if (!candidates.length) return;
  const section = el('section', 'web-candidate-section');
  section.append(
    el('h3', '', 'Resultados da pesquisa web'),
    el('p', 'muted-line', 'Use candidatos incompletos como pista. Frete e imposto ausentes nao entram como zero.')
  );

  for (const group of groupCandidates(candidates)) {
    const groupSection = el('section', 'candidate-group');
    groupSection.dataset.group = group.key;
    groupSection.append(el('h4', '', group.title), el('p', 'muted-line', group.description));
    groupSection.append(...group.candidates.map(renderWebCandidate));
    section.append(groupSection);
  }

  container.append(section);
}
