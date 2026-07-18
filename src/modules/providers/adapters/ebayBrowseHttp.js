import { ServiceUnavailableError } from '../../../shared/errors.js';
import { EBAY_PROVIDER_NAME, ensureEbayCredentials } from './ebayBrowseConfig.js';

export async function fetchEbayJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await options.fetchImpl(url, {
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ServiceUnavailableError('eBay Browse API retornou resposta indisponivel.', {
        providerName: EBAY_PROVIDER_NAME,
        statusCode: response.status
      });
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    if (error?.name === 'AbortError') {
      throw new ServiceUnavailableError('Timeout ao consultar eBay Browse API.', {
        providerName: EBAY_PROVIDER_NAME,
        timeoutMs: options.timeoutMs
      });
    }

    throw new ServiceUnavailableError('Falha sanitizada ao consultar eBay Browse API.', {
      providerName: EBAY_PROVIDER_NAME
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function getEbayAccessToken(config, tokenCacheRef) {
  if (config.accessToken) {
    return config.accessToken;
  }

  ensureEbayCredentials(config);

  if (tokenCacheRef.value && tokenCacheRef.value.expiresAt > Date.now()) {
    return tokenCacheRef.value.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: config.scope
  });
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const payload = await fetchEbayJson(config.oauthBaseUrl, {
    method: 'POST',
    timeoutMs: config.requestTimeoutMs,
    fetchImpl: config.fetchImpl,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  });

  if (!payload?.access_token) {
    throw new ServiceUnavailableError('eBay OAuth nao retornou token de aplicacao.', {
      providerName: EBAY_PROVIDER_NAME
    });
  }

  tokenCacheRef.value = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, Number(payload.expires_in || 0) - 60) * 1000
  };

  return tokenCacheRef.value.accessToken;
}
