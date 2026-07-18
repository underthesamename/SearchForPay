import { el, formatMoney } from './dom.js';

function resultText(alert) {
  const result = alert.lastResult;

  if (!result) {
    return 'Aguardando primeira revalidacao real.';
  }

  if (result.status === 'target_met') {
    return `${result.message} Melhor total: ${formatMoney(result.bestOffer?.totalCost)}.`;
  }

  if (result.status === 'target_not_met' && result.bestOffer) {
    return `${result.message} Melhor total atual: ${formatMoney(result.bestOffer.totalCost)}.`;
  }

  return result.message;
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

  body.append(el('strong', '', alert.query));
  body.append(el('span', '', `${alert.context.postalCodeMasked} / ${alert.context.country} / ${alert.context.currency}`));
  body.append(el('span', '', `Alvo: ${formatMoney(alert.targetTotalCost)}`));
  body.append(el('p', 'alert-result', resultText(alert)));
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
