import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiWebProvider } from '../src/modules/providers/adapters/openaiSearchAdapter.js';
import { validateProvider } from '../src/modules/providers/contract.js';
import { ConfigurationError, ServiceUnavailableError } from '../src/shared/errors.js';

const request = Object.freeze({
  query: 'Notebook',
  normalizedQuery: 'notebook',
  context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
});
const apiKey = 'openai-key-redigida';

function candidate(overrides = {}) {
  return {
    productTitle: 'Notebook com evidencia real',
    storeName: 'Fonte informada pela web',
    productUrl: 'https://example.com/notebook',
    visiblePrice: { amountCents: 250000, currency: 'BRL' },
    shipping: { exposed: true, amountCents: 1800, currency: 'BRL', warning: null },
    taxes: { exposed: true, amountCents: 3200, currency: 'BRL', warning: null },
    evidence: [{
      url: 'https://example.com/notebook',
      title: 'Pagina consultada do notebook',
      snippet: 'Trecho curto com preco e detalhes consultados na fonte.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'high',
    warnings: [],
    availability: 'available',
    delivery: { minDays: null, maxDays: null },
    ...overrides
  };
}

function jsonResponse(candidates) {
  return {
    ok: true,
    async json() {
      return {
        output_text: JSON.stringify({
          research: {
            searchMode: 'web_research',
            productQuery: 'Notebook',
            searchedQueries: ['Notebook preco BRL'],
            sourcesSearched: ['https://example.com/notebook'],
            generatedAt: '2026-07-18T12:00:00.000Z',
            warnings: []
          },
          candidates
        })
      };
    }
  };
}

test('adapter openaiweb cumpre contrato de Provider real', () => {
  const provider = createOpenAiWebProvider();
  const validation = validateProvider(provider);

  assert.equal(validation.valid, true);
  assert.equal(provider.name, 'openaiweb');
  assert.equal(provider.source.type, 'api');
  assert.equal(provider.source.name, 'OpenAI Responses API web_search');
});

test('adapter openaiweb falha com configuracao clara quando falta chave', async () => {
  const provider = createOpenAiWebProvider({ enabled: true });

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.providerName, 'openaiweb');
      assert.deepEqual(error.details.required, ['OPENAI_API_KEY', 'OPENAI_SEARCH_MODEL']);
      return true;
    }
  );
});

test('adapter openaiweb falha claramente quando esta desativado', async () => {
  const provider = createOpenAiWebProvider({
    apiKey,
    enabled: false,
    disabledReason: 'OPENAI_SEARCH_ENABLED=false.'
  });

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.providerName, 'openaiweb');
      assert.equal(error.details.disabled, true);
      assert.equal(error.details.reason, 'OPENAI_SEARCH_ENABLED=false.');
      return true;
    }
  );
});

test('adapter openaiweb monta chamada Responses API sem expor chave no corpo', async () => {
  const seen = {};
  const provider = createOpenAiWebProvider({
    apiKey,
    enabled: true,
    contextSize: 'high',
    maxCandidates: 4,
    fetchImpl: async (url, options) => {
      seen.url = String(url);
      seen.headers = options.headers;
      seen.body = JSON.parse(options.body);

      return jsonResponse([candidate()]);
    }
  });

  const result = await provider.search(request);

  assert.equal(seen.url, 'https://api.openai.com/v1/responses');
  assert.equal(seen.headers.Authorization, `Bearer ${apiKey}`);
  assert.deepEqual(seen.body.tools, [{ type: 'web_search', search_context_size: 'high' }]);
  assert.equal(seen.body.text.format.type, 'json_schema');
  assert.equal(seen.body.text.format.schema.required.includes('research'), true);
  assert.equal(seen.body.store, false);
  assert.equal(JSON.parse(seen.body.input[1].content[0].text).maxCandidates, 4);
  assert.equal(JSON.stringify(seen.body).includes(apiKey), false);
  assert.equal(result.offers.length, 1);
  assert.equal(result.offers[0].providerName, 'openaiweb');
  assert.deepEqual(result.offers[0].taxes, { amountCents: 3200, currency: 'BRL' });
  assert.equal(result.report.candidatesExtracted, 1);
  assert.equal(result.report.candidatesRejected, 0);
});

test('adapter openaiweb sanitiza erro HTTP sem expor chave', async () => {
  const privateKey = 'openai-key-privada';
  const provider = createOpenAiWebProvider({
    apiKey: privateKey,
    enabled: true,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return { message: privateKey };
      }
    })
  });

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.providerName, 'openaiweb');
      assert.equal(error.details.statusCode, 401);
      assert.equal(JSON.stringify(error).includes(privateKey), false);
      return true;
    }
  );
});
