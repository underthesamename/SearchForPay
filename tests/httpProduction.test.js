import { createServer } from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnv } from '../src/config/env.js';
import { createApp } from '../src/http/app.js';
import { createSafeLogger } from '../src/http/safeLogger.js';
import { ServiceUnavailableError } from '../src/shared/errors.js';

const OPENAI_KEY_LABEL = ['OPENAI', 'API', 'KEY'].join('_');

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

test('cache guarda somente resposta publica sanitizada', async () => {
  const privateKey = 'openai-key-redacted-cache-test-value';
  let calls = 0;

  await withServer({
    env: env(),
    providerRegistry: registry(),
    searchService: {
      async search() {
        calls += 1;
        return {
          ...searchPayload(),
          meta: {
            providerReports: [],
            debug: {
              apiKey: privateKey,
              authorization: `Bearer ${privateKey}`,
              message: `${OPENAI_KEY_LABEL}=${privateKey}`,
              postalCode: '01001000'
            }
          }
        };
      }
    }
  }, async (baseUrl) => {
    const path = '/api/search?query=Monitor&postalCode=01001000&country=BR&currency=BRL';
    const first = await fetch(`${baseUrl}${path}`);
    const firstPayload = await first.json();
    const second = await fetch(`${baseUrl}${path}`);
    const secondPayload = await second.json();
    const serialized = JSON.stringify([firstPayload, secondPayload]);

    assert.equal(first.headers.get('x-cache'), 'MISS');
    assert.equal(second.headers.get('x-cache'), 'HIT');
    assert.equal(calls, 1);
    assert.doesNotMatch(serialized, new RegExp(privateKey));
    assert.doesNotMatch(serialized, /OPENAI_API_KEY/);
    assert.doesNotMatch(serialized, /01001000/);
    assert.match(serialized, /CEP final 000/);
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
  const privateKey = 'openai-key-redacted-path-test-value';

  await withServer({
    env: env({ REQUEST_LOGGING_ENABLED: 'true' }),
    logger: createSafeLogger({ sink: { info: (event) => logs.push(event) } }),
    providerRegistry: registry(),
    searchService: { search: async () => searchPayload() }
  }, async (baseUrl) => {
    await fetch(`${baseUrl}/api/search?query=Monitor&postalCode=01001000&country=BR&currency=BRL`);
    await fetch(`${baseUrl}/api/debug/${privateKey}?query=OPENAI_API_KEY`);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const serialized = JSON.stringify(logs);
    assert.match(serialized, /"route":"\/api\/search"/);
    assert.doesNotMatch(serialized, /01001000/);
    assert.doesNotMatch(serialized, /Monitor/);
    assert.doesNotMatch(serialized, new RegExp(privateKey));
    assert.doesNotMatch(serialized, /OPENAI_API_KEY/);
  });
});

test('erro HTTP sanitiza token externo e CEP antes de responder', async () => {
  const privateKey = 'openai-key-redacted-upstream-test-value';

  await withServer({
    env: env(),
    providerRegistry: registry(),
    searchService: {
      async search() {
        throw new ServiceUnavailableError(`Falha externa com ${privateKey}`, {
          providerName: 'openaiweb',
          apiKey: privateKey,
          authorization: `Bearer ${privateKey}`,
          postalCode: '01001000',
          reason: `${OPENAI_KEY_LABEL}=${privateKey}`
        });
      }
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/search?query=Monitor&postalCode=01001000&country=BR&currency=BRL`);
    const text = await response.text();
    const payload = JSON.parse(text);

    assert.equal(response.status, 503);
    assert.equal(payload.error.code, 'SERVICE_UNAVAILABLE');
    assert.doesNotMatch(text, new RegExp(privateKey));
    assert.doesNotMatch(text, /OPENAI_API_KEY/);
    assert.doesNotMatch(text, /01001000/);
    assert.match(text, /CEP final 000/);
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

test('api revalida candidato por rota dedicada sem usar fallback ficticio', async () => {
  let received;

  await withServer({
    env: env(),
    providerRegistry: registry(),
    searchService: { search: async () => searchPayload() },
    candidateRevalidationService: {
      async revalidate(input) {
        received = input;
        return {
          status: 'confirmado',
          productUrl: input.candidate.productUrl,
          lastVerifiedAt: '2026-07-18T12:30:00.000Z',
          evidence: input.candidate.evidence,
          currentCandidate: input.candidate,
          comparisons: {}
        };
      }
    }
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/candidates/revalidate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: 'Monitor',
        context: { country: 'BR', currency: 'BRL', postalCode: '01001000' },
        candidate: {
          productTitle: 'Monitor verificavel',
          productUrl: 'https://example.com/monitor',
          visiblePrice: { amountCents: 90000, currency: 'BRL' },
          shipping: { exposed: true, amountCents: 1000, currency: 'BRL' },
          taxes: { exposed: true, amountCents: 500, currency: 'BRL' },
          evidence: [{
            url: 'https://example.com/monitor',
            title: 'Pagina do monitor',
            snippet: 'Trecho com custo exposto.',
            accessedAt: '2026-07-18T12:00:00.000Z'
          }]
        }
      })
    });

    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.revalidation.status, 'confirmado');
    assert.equal(received.candidate.productUrl, 'https://example.com/monitor');
  });
});
