import { createServer } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnv } from '../src/config/env.js';
import { createApp } from '../src/http/app.js';
import { createSafeLogger } from '../src/http/safeLogger.js';

function registry() {
  return {
    getConfiguredProviderNames: () => ['marketplace-real'],
    getEnabledProviderNames: () => ['marketplace-real'],
    getUnknownProviders: () => []
  };
}

function searchPayload() {
  return {
    query: 'Monitor',
    normalizedQuery: 'monitor',
    context: { postalCode: '01001000', country: 'BR', currency: 'BRL' },
    results: [],
    meta: { providerReports: [] }
  };
}

async function withServer(options, callback) {
  const app = createApp(options);
  const server = createServer(app);

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.close?.();
  }
}

function env(overrides = {}) {
  return getEnv({
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX_REQUESTS: '100',
    REQUEST_LOGGING_ENABLED: 'false',
    SEARCH_CACHE_TTL_MS: '60000',
    ...overrides
  }, {
    loadDotEnv: false
  });
}

test('api aplica rate limit nas rotas protegidas', async () => {
  await withServer({
    env: env({ RATE_LIMIT_MAX_REQUESTS: '1' }),
    providerRegistry: registry(),
    searchService: { search: async () => searchPayload() }
  }, async (baseUrl) => {
    const path = '/api/search?query=Monitor&postalCode=01001000&country=BR&currency=BRL';
    const first = await fetch(`${baseUrl}${path}`);
    const second = await fetch(`${baseUrl}${path}`);

    assert.equal(first.status, 200);
    assert.equal(second.status, 429);
    assert.equal(second.headers.get('retry-after'), '60');
    assert.equal((await second.json()).error.code, 'RATE_LIMITED');
  });
});

test('busca manual usa cache curto sem reconsultar servico', async () => {
  let calls = 0;

  await withServer({
    env: env(),
    providerRegistry: registry(),
    searchService: {
      async search() {
        calls += 1;
        return searchPayload();
      }
    }
  }, async (baseUrl) => {
    const path = '/api/search?query=Monitor&postalCode=01001000&country=BR&currency=BRL';
    const first = await fetch(`${baseUrl}${path}`);
    const second = await fetch(`${baseUrl}${path}`);

    assert.equal(first.headers.get('x-cache'), 'MISS');
    assert.equal(second.headers.get('x-cache'), 'HIT');
    assert.equal(calls, 1);
  });
});

test('respostas carregam headers seguros basicos', async () => {
  await withServer({
    env: env(),
    providerRegistry: registry(),
    searchService: { search: async () => searchPayload() }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-frame-options'), 'DENY');
    assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
  });
});

test('logs de requisicao nao incluem query string nem CEP', async () => {
  const logs = [];

  await withServer({
    env: env({ REQUEST_LOGGING_ENABLED: 'true' }),
    logger: createSafeLogger({ sink: { info: (event) => logs.push(event) } }),
    providerRegistry: registry(),
    searchService: { search: async () => searchPayload() }
  }, async (baseUrl) => {
    await fetch(`${baseUrl}/api/search?query=Monitor&postalCode=01001000&country=BR&currency=BRL`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const serialized = JSON.stringify(logs);
    assert.match(serialized, /"route":"\/api\/search"/);
    assert.doesNotMatch(serialized, /01001000/);
    assert.doesNotMatch(serialized, /Monitor/);
  });
});

test('post json rejeita content-type invalido antes de criar alerta', async () => {
  let created = false;

  await withServer({
    env: env(),
    providerRegistry: registry(),
    searchService: { search: async () => searchPayload() },
    alertService: {
      createAlert: async () => {
        created = true;
      },
      listAlerts: async () => []
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'sem-json'
    });

    assert.equal(response.status, 400);
    assert.equal(created, false);
  });
});
