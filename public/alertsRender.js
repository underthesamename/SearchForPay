import { el, formatMoney } from './dom.js';

function resultText(alert) {
  const result = alert.lastResult;

  if (!result) {
    return 'Aguardando primeira revalidacao real.';
  }

  if (result.status === 'target_met') {
    return `${result.message} Total revalidado: ${formatMoney(result.bestOffer?.totalCost)}.`;
  }

  if (result.status === 'target_not_met' && result.bestOffer) {
    return `${result.message} Total revalidado atual: ${formatMoney(result.bestOffer.totalCost)}.`;
  }

  return result.message;
}

function checkedText(alert) {
  const checkedAt = alert.lastCheckedAt || alert.lastResult?.checkedAt;
  if (!checkedAt) return 'Ultima checagem: pendente.';
  return `Ultima checagem: ${new Date(checkedAt).toLocaleString('pt-BR')}.`;
}

function verificationText(alert) {
  const verification = alert.lastVerification || alert.lastResult?.lastVerification;
  if (!verification?.lastVerifiedAt) return 'Ultima verificacao: pendente.';
  return `Ultima verificacao: ${verification.status} em ${new Date(verification.lastVerifiedAt).toLocaleString('pt-BR')}.`;
}

function firstEvidence(alert) {
  const evidence = [
    ...(alert.lastResult?.evidence || []),
    ...(alert.lastResult?.bestOffer?.evidence || []),
    ...(alert.lastVerification?.evidence || []),
    ...(alert.candidateTarget?.evidence || [])
  ];

  return evidence.find((item) => item?.url);
}

function appendEvidence(parent, alert) {
  const evidence = firstEvidence(alert);
  if (!evidence) return;

  const link = el('a', 'alert-evidence', evidence.title || 'Evidencia da ultima checagem');
  link.href = evidence.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  parent.append(link);
}

function renderAlert(alert) {
  const item = el('article', 'alert-item');
  const body = el('div', 'alert-body');
  const actions = el('div', 'alert-actions');
  const checkButton = el('button', 'quiet-button', 'Revalidar');
  const deleteButton = el('button', 'quiet-button', 'Remover');

  item.dataset.alertStatus = alert.lastResult?.status || 'pending';
  checkButton.type = 'button';
  checkButton.dataset.alertAction = 'check';
  checkButton.dataset.alertId = alert.id;
  deleteButton.type = 'button';
  deleteButton.dataset.alertAction = 'delete';
  deleteButton.dataset.alertId = alert.id;

  body.append(el('span', 'alert-status-chip', alert.lastResult?.status || 'pendente'));
  body.append(el('strong', '', alert.query));
  body.append(el('span', '', alert.sourceType === 'candidate' ? 'Origem: candidato salvo' : 'Origem: busca salva'));
  if (alert.candidateTarget?.productTitle) {
    body.append(el('span', '', `Candidato: ${alert.candidateTarget.productTitle}`));
  }
  body.append(el('span', '', `${alert.context.postalCodeMasked} / ${alert.context.country} / ${alert.context.currency}`));
  body.append(el('span', '', `Alvo: ${formatMoney(alert.targetTotalCost)}`));
  body.append(el('span', '', checkedText(alert)));
  body.append(el('span', '', verificationText(alert)));
  body.append(el('p', 'alert-result', resultText(alert)));
  appendEvidence(body, alert);
  actions.append(checkButton, deleteButton);
  item.append(body, actions);
  return item;
}

export function renderAlerts(alertList, alerts) {
  alertList.replaceChildren();

  if (!alerts.length) {
    alertList.append(el('p', 'memory-empty', 'Nenhum alerta salvo.'));
    return;
  }

  alertList.append(...alerts.map(renderAlert));
}
