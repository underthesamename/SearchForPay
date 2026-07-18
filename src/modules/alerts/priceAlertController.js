import { sendJson } from '../../http/responses.js';
import { readJsonBody } from '../../http/requestBody.js';

export async function handleListAlertsRequest({ response, alertService }) {
  return sendJson(response, 200, {
    alerts: await alertService.listAlerts()
  });
}

export async function handleCreateAlertRequest({ request, response, alertService, bodyLimitBytes }) {
  const input = await readJsonBody(request, { maxBytes: bodyLimitBytes });

  return sendJson(response, 201, {
    alert: await alertService.createAlert(input)
  });
}

export async function handleCheckAlertRequest({ response, alertService, alertId }) {
  return sendJson(response, 200, {
    alert: await alertService.checkAlert(alertId)
  });
}

export async function handleDeleteAlertRequest({ response, alertService, alertId }) {
  return sendJson(response, 200, await alertService.removeAlert(alertId));
}
