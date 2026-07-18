import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpenAiSearchClient } from '../src/modules/ai-search/openaiSearchClient.js';
import { ServiceUnavailableError } from '../src/shared/errors.js';

const request = Object.freeze({
  query: 'Notebook',
  normalizedQuery: 'notebook',
  context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
});
const apiKey = 'openai-key-redigida';

function research() {
  return {
    searchMode: 'web_research',
    productQuery: 'Notebook',
    searchedQueries: ['Notebook preco BRL'],
    sourcesSearched: ['https://example.com/notebook'],
    generatedAt: '2026-07-18T12:00:00.000Z',
    warnings: []
  };
}

function candidate(overrides = {}) {
  return {
    productTitle: 'Notebook para fixture de contrato',
    storeName: 'Fonte de teste do contrato',
    productUrl: 'https://example.com/notebook',
    visiblePrice: { amountCents: 250000, currency: 'BRL' },
    shipping: { exposed: false, amountCents: null, currency: null, warning: 'Frete nao exposto.' },
    taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao exposto.' },
    evidence: [{
      url: 'https://example.com/notebook',
      title: 'Pagina usada no teste de contrato',
      snippet: 'Trecho curto usado apenas para validar o formato estruturado.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'medium',
    warnings: ['Candidato usado apenas como fixture de contrato.'],
    availability: 'available',
    delivery: { minDays: null, maxDays: null },
    ...overrides
  };
}

function candidatePayload(candidates = [candidate()]) {
  return { research: research(), candidates };
}

function okResponse(outputText) {
  return { ok: true, status: 200, async json() { return { output_text: outputText }; } };
}

function createClient(fetchImpl, overrides = {}) {
  return createOpenAiSearchClient({
    apiKey,
    responsesUrl: 'https://api.openai.com/v1/responses',
    model: 'gpt-5.6',
    contextSize: 'high',
    maxCandidates: 3,
    timeoutMs: 4321,
    storeResponses: false,
    fetchImpl,
    ...overrides
  });
}

test('openaiSearchClient chama Responses API com web_search e JSON Schema', async () => {
  const seen = {};
  const client = createClient(async (url, options) => {
    seen.url = String(url);
    seen.headers = options.headers;
    seen.body = JSON.parse(options.body);
    seen.signal = options.signal;

    return okResponse(JSON.stringify(candidatePayload([candidate()])));
  });

  const payload = await client.searchCandidates(request);
  const userPayload = JSON.parse(seen.body.input[1].content[0].text);

  assert.equal(seen.url, 'https://api.openai.com/v1/responses');
  assert.equal(seen.headers.Authorization, `Bearer ${apiKey}`);
  assert.deepEqual(seen.body.tools, [{ type: 'web_search', search_context_size: 'high' }]);
  assert.equal(seen.body.text.format.type, 'json_schema');
  assert.equal(seen.body.text.format.strict, true);
  assert.equal(seen.body.text.format.schema.required.includes('research'), true);
  assert.equal(seen.body.text.format.schema.required.includes('candidates'), true);
  assert.equal(userPayload.searchMode, 'web_research');
  assert.equal(userPayload.sourceTarget, 3);
  assert.ok(userPayload.rejectionRules.includes('Nao inclua candidato sem preco visivel.'));
  assert.equal(JSON.stringify(seen.body).includes(apiKey), false);
  assert.equal(seen.signal.aborted, false);
  assert.equal(payload.research.searchMode, 'web_research');
  assert.equal(payload.candidates.length, 1);
});

test('openaiSearchClient sanitiza erros HTTP 401, 429 e 500', async () => {
  const privateKey = 'openai-key-privada';

  for (const status of [401, 429, 500]) {
    const client = createClient(async () => ({
      ok: false,
      status,
      async json() {
        return { error: privateKey, postalCode: request.context.postalCode };
      }
    }), { apiKey: privateKey });

    await assert.rejects(
      () => client.searchCandidates(request),
      (error) => {
        assert.ok(error instanceof ServiceUnavailableError);
        assert.equal(error.details.statusCode, status);
        assert.equal(JSON.stringify(error).includes(privateKey), false);
        assert.equal(JSON.stringify(error).includes(request.context.postalCode), false);
        return true;
      }
    );
  }
});

test('openaiSearchClient rejeita JSON invalido vindo da API', async () => {
  const client = createClient(async () => okResponse('{"candidates": ['));

  await assert.rejects(
    () => client.searchCandidates(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.message, 'OpenAI web_search retornou JSON invalido.');
      return true;
    }
  );
});

test('openaiSearchClient rejeita JSON valido fora do contrato', async () => {
  const client = createClient(async () => okResponse(JSON.stringify({ candidates: [] })));

  await assert.rejects(
    () => client.searchCandidates(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.message, 'OpenAI web_search retornou JSON fora do contrato.');
      return true;
    }
  );
});

test('openaiSearchClient limita candidatos excedentes retornados pela API', async () => {
  const client = createClient(async () => okResponse(JSON.stringify(candidatePayload([
    candidate({ productUrl: 'https://example.com/notebook-1' }),
    candidate({ productUrl: 'https://example.com/notebook-2' }),
    candidate({ productUrl: 'https://example.com/notebook-3' })
  ]))), { maxCandidates: 2 });

  const payload = await client.searchCandidates(request);

  assert.equal(payload.candidates.length, 2);
  assert.equal(payload.candidates[1].productUrl, 'https://example.com/notebook-2');
});

test('openaiSearchClient retorna timeout sanitizado', async () => {
  const client = createClient(async () => {
    const error = new Error('erro bruto com dado sensivel');
    error.name = 'AbortError';
    throw error;
  }, { timeoutMs: 7 });

  await assert.rejects(
    () => client.searchCandidates(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.timeoutMs, 7);
      assert.equal(JSON.stringify(error).includes('dado sensivel'), false);
      return true;
    }
  );
});
