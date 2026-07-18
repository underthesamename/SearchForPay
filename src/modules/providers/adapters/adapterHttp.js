import { ServiceUnavailableError } from '../../../shared/errors.js';

export async function fetchJsonWithTimeout({
  providerName,
  url,
  fetchImpl,
  timeoutMs,
  method = 'GET',
  headers,
  body,
  unavailableMessage,
  timeoutMessage,
  failureMessage
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ServiceUnavailableError(unavailableMessage, {
        providerName,
        statusCode: response.status
      });
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      throw new ServiceUnavailableError(timeoutMessage, {
        providerName,
        timeoutMs
      });
    }

    throw new ServiceUnavailableError(failureMessage, {
      providerName
    });
  } finally {
    clearTimeout(timeout);
  }
}
