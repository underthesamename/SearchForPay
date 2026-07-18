import test from 'node:test';
import assert from 'node:assert/strict';
import { createEbayBrowseProvider } from '../src/modules/providers/adapters/ebayBrowseAdapter.js';
import { validateProvider } from '../src/modules/providers/contract.js';
import { ConfigurationError, ServiceUnavailableError } from '../src/shared/errors.js';

const searchRequest = Object.freeze({
  query: 'Monitor',
  normalizedQuery: 'monitor',
  context: {
    postalCode: '10001',
    country: 'US',
    currency: 'USD'
  }
});

test('adapter ebay cumpre contrato de Provider real', () => {
  const provider = createEbayBrowseProvider();
  const validation = validateProvider(provider);

  assert.equal(validation.valid, true);
  assert.equal(provider.name, 'ebay');
  assert.equal(provider.source.type, 'api');
  assert.equal(provider.source.name, 'eBay Browse API');
  assert.ok(provider.source.url.startsWith('https://'));
});

test('adapter ebay falha com configuracao clara quando nao ha credencial', async () => {
  const provider = createEbayBrowseProvider({
    fetchImpl() {
      throw new Error('fetch nao deveria ser chamado sem credencial');
    }
  });

  await assert.rejects(
    () => provider.search(searchRequest),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.message, 'Credenciais do eBay Browse API ausentes.');
      assert.equal(error.details.providerName, 'ebay');
      assert.deepEqual(error.details.required, ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET']);
      assert.equal(error.details.alternative, 'EBAY_BROWSE_ACCESS_TOKEN');
      return true;
    }
  );
});

test('adapter ebay rejeita endpoint nao HTTPS como erro de configuracao', async () => {
  const provider = createEbayBrowseProvider({
    accessToken: 'token-redigido-para-teste',
    browseBaseUrl: 'http://api.ebay.example.invalid',
    fetchImpl() {
      throw new Error('fetch nao deveria ser chamado com endpoint invalido');
    }
  });

  await assert.rejects(
    () => provider.search(searchRequest),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.message, 'Endpoint do eBay Browse API invalido.');
      assert.equal(error.details.providerName, 'ebay');
      return true;
    }
  );
});

test('adapter ebay sanitiza erro HTTP sem expor token', async () => {
  const token = 'token-redigido-que-nao-pode-vazar';
  const provider = createEbayBrowseProvider({
    accessToken: token,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return {};
      }
    })
  });

  await assert.rejects(
    () => provider.search(searchRequest),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.message, 'eBay Browse API retornou resposta indisponivel.');
      assert.equal(error.details.providerName, 'ebay');
      assert.equal(error.details.statusCode, 401);
      assert.equal(JSON.stringify(error).includes(token), false);
      return true;
    }
  );
});

test('adapter ebay aplica timeout sanitizado por chamada', async () => {
  const provider = createEbayBrowseProvider({
    accessToken: 'token-redigido-para-timeout',
    requestTimeoutMs: 1,
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('AbortError');
        error.name = 'AbortError';
        reject(error);
      });
    })
  });

  await assert.rejects(
    () => provider.search(searchRequest),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.message, 'Timeout ao consultar eBay Browse API.');
      assert.equal(error.details.providerName, 'ebay');
      assert.equal(error.details.timeoutMs, 1);
      return true;
    }
  );
});
