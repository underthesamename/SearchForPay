import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiSearchClient } from '../src/modules/ai-search/openaiSearchClient.js';
import { ConfigurationError, ServiceUnavailableError } from '../src/shared/errors.js';

const request = Object.freeze({
  query: 'Notebook',
  normalizedQuery: 'notebook',
  context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
});
const apiKey = 'openai-key-privada';

function emptyCandidatePayload() {
  return {
    research: {
      searchMode: 'web_research',
      productQuery: 'Notebook',
      searchedQueries: ['Notebook preco BRL'],
      sourcesSearched: ['https://example.com/notebook'],
      generatedAt: '2026-07-18T12:00:00.000Z',
      warnings: []
    },
    candidates: []
  };
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    async json() {
      return { output_text: JSON.stringify(emptyCandidatePayload()) };
    }
  };
}

function createClient(fetchImpl, overrides = {}) {
  return createOpenAiSearchClient({
    apiKey,
    responsesUrl: 'https://api.openai.com/v1/responses',
    model: 'gpt-5.6',
    maxCandidates: 8,
    timeoutMs: 15000,
    fetchImpl,
    ...overrides
  });
}

test('openaiSearchClient falha com chave ausente antes de chamar fetch', async () => {
  let calls = 0;
  const client = createClient(async () => {
    calls += 1;
    return okResponse();
  }, { apiKey: '' });

  await assert.rejects(
    () => client.searchCandidates(request),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.providerName, 'openaiweb');
      assert.deepEqual(error.details.required, ['OPENAI_API_KEY', 'OPENAI_SEARCH_MODEL']);
      assert.equal(JSON.stringify(error).includes(apiKey), false);
      return true;
    }
  );
  assert.equal(calls, 0);
});

test('openaiSearchClient limita candidatos por busca no prompt enviado', async () => {
  let body;
  const client = createClient(async (_url, options) => {
    body = JSON.parse(options.body);
    return okResponse();
  }, { maxCandidates: 99 });

  await client.searchCandidates(request);

  const userPayload = JSON.parse(body.input[1].content[0].text);
  assert.equal(userPayload.maxCandidates, 10);
  assert.equal(JSON.stringify(body).includes(apiKey), false);
});

test('openaiSearchClient aplica rate limit local antes de chamar fetch', async () => {
  let calls = 0;
  const client = createClient(async () => {
    calls += 1;
    return okResponse();
  }, {
    rateLimitMaxRequests: 1,
    rateLimitWindowMs: 60 * 1000,
    rateLimitNow: () => 1000
  });

  await client.searchCandidates(request);

  await assert.rejects(
    () => client.searchCandidates(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.message, 'Rate limit local da pesquisa OpenAI atingido.');
      assert.equal(error.details.rateLimitMaxRequests, 1);
      return true;
    }
  );
  assert.equal(calls, 1);
});

test('openaiSearchClient retorna mensagem clara para rate limit', async () => {
  let bodyRead = false;
  const client = createClient(async () => ({
    ok: false,
    status: 429,
    headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? '12' : null) },
    async json() {
      bodyRead = true;
      return { error: apiKey, payload: request };
    }
  }));

  await assert.rejects(
    () => client.searchCandidates(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.message, 'OpenAI Responses API atingiu limite de uso temporario.');
      assert.equal(error.details.statusCode, 429);
      assert.equal(error.details.retryAfter, '12');
      assert.equal(JSON.stringify(error).includes(apiKey), false);
      assert.equal(JSON.stringify(error).includes(request.context.postalCode), false);
      return true;
    }
  );
  assert.equal(bodyRead, false);
});

test('openaiSearchClient retorna indisponibilidade sanitizada sem corpo bruto', async () => {
  let bodyRead = false;
  const client = createClient(async () => ({
    ok: false,
    status: 500,
    async json() {
      bodyRead = true;
      return { message: apiKey };
    }
  }));

  await assert.rejects(
    () => client.searchCandidates(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.message, 'OpenAI Responses API retornou resposta indisponivel.');
      assert.equal(error.details.statusCode, 500);
      assert.equal(JSON.stringify(error).includes(apiKey), false);
      return true;
    }
  );
  assert.equal(bodyRead, false);
});
