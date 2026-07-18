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
    title: 'Notebook com evidencia real',
    sellerName: 'Vendedor informado pela fonte',
    productUrl: 'https://example.com/notebook',
    currency: 'BRL',
    availability: 'available',
    price: {
      amountCents: 250000,
      evidenceUrl: 'https://example.com/notebook',
      evidenceText: 'Preco informado na pagina consultada.'
    },
    shipping: {
      amountCents: 1800,
      exposed: true,
      evidenceUrl: 'https://example.com/notebook/frete',
      evidenceText: 'Frete informado para o contexto consultado.',
      warning: null
    },
    taxes: {
      amountCents: 3200,
      evidenceUrl: 'https://example.com/notebook/imposto',
      evidenceText: 'Imposto informado na pagina consultada.'
    },
    delivery: {
      minDays: 2,
      maxDays: 5,
      evidenceUrl: 'https://example.com/notebook/frete',
      evidenceText: 'Prazo informado na pagina consultada.'
    },
    confidenceLevel: 'high',
    confidenceReasons: ['Campos obrigatorios tinham evidencia.'],
    rejected: false,
    rejectionReason: null,
    ...overrides
  };
}

function openAiPayload(candidates) {
  return { output_text: JSON.stringify({ candidates }) };
}

function jsonResponse(candidates) {
  return { ok: true, async json() { return openAiPayload(candidates); } };
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
  const provider = createOpenAiWebProvider();

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

test('adapter openaiweb monta chamada Responses API sem expor chave no corpo', async () => {
  const seen = {};
  const provider = createOpenAiWebProvider({
    apiKey,
    searchLimit: 4,
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
  assert.deepEqual(seen.body.tools, [{ type: 'web_search' }]);
  assert.equal(seen.body.text.format.type, 'json_schema');
  assert.equal(seen.body.store, false);
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
