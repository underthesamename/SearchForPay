import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductResearchService } from '../src/modules/ai-search/productResearchService.js';
import { ConfigurationError, ServiceUnavailableError, ValidationError } from '../src/shared/errors.js';

const searchedAt = new Date('2026-07-18T12:00:00.000Z');

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
    productTitle: 'Notebook validado pela pesquisa',
    storeName: 'Fonte de teste da pesquisa',
    productUrl: 'https://example.com/notebook',
    visiblePrice: { amountCents: 250000, currency: 'BRL' },
    shipping: { exposed: false, amountCents: null, currency: null, warning: 'Frete nao exposto.' },
    taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao confirmado.' },
    evidence: [{
      url: 'https://example.com/notebook',
      title: 'Pagina consultada do produto',
      snippet: 'Trecho curto com evidencia consultada pela pesquisa.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'medium',
    warnings: ['Confirmar detalhes no site da fonte.'],
    availability: 'available',
    delivery: { minDays: null, maxDays: null },
    ...overrides
  };
}

function serviceWithClient(searchCandidates) {
  return createProductResearchService({
    now: () => searchedAt,
    openAiSearchClient: { searchCandidates }
  });
}

test('productResearchService rejeita query vazia', async () => {
  const service = serviceWithClient(async () => ({ candidates: [] }));

  await assert.rejects(
    () => service.research({ query: ' ', country: 'BR', currency: 'BRL' }),
    (error) => error instanceof ValidationError
  );
});

test('productResearchService falha claramente quando OpenAI esta desativada', async () => {
  const service = createProductResearchService({
    openAiConfig: {
      enabled: false,
      disabledReason: 'OPENAI_SEARCH_ENABLED=false.'
    }
  });

  await assert.rejects(
    () => service.research({ query: 'Notebook', country: 'BR', currency: 'BRL' }),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.disabled, true);
      assert.equal(error.details.reason, 'OPENAI_SEARCH_ENABLED=false.');
      return true;
    }
  );
});

test('productResearchService retorna candidatos validos sem ranquear como oferta final', async () => {
  const seen = {};
  const service = serviceWithClient(async (request) => {
    Object.assign(seen, request);
    return { research: research(), candidates: [candidate()] };
  });

  const result = await service.research({
    query: '  Notebook   Gamer  ',
    country: 'BR',
    currency: 'BRL',
    postalCode: '01001-000'
  });

  assert.equal(seen.normalizedQuery, 'notebook gamer');
  assert.deepEqual(seen.context.delivery, { postalCode: '01001-000' });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].researchStatus.rankableOffer, false);
  assert.equal(result.candidates[0].researchStatus.canProceedToOfferValidation, false);
  assert.ok(result.meta.warnings.includes('Imposto nao confirmado; candidato nao pode virar oferta final.'));
  assert.deepEqual(result.meta, {
    searchMode: 'web_research',
    research: research(),
    totalCandidatesFound: 1,
    validCandidates: 1,
    discardedCandidates: 0,
    warnings: result.meta.warnings,
    searchedAt: searchedAt.toISOString()
  });
});

test('productResearchService preserva contexto de revalidacao para OpenAI Web Search', async () => {
  const seen = {};
  const service = serviceWithClient(async (request) => {
    Object.assign(seen, request);
    return { research: research(), candidates: [candidate()] };
  });

  await service.research({
    query: 'Notebook',
    country: 'BR',
    currency: 'BRL',
    revalidation: {
      productUrl: 'https://example.com/notebook',
      evidence: candidate().evidence
    }
  });

  assert.equal(seen.context.revalidation.productUrl, 'https://example.com/notebook');
  assert.equal(seen.context.revalidation.evidence.length, 1);
});

test('productResearchService descarta candidatos sem preco ou evidencia pelo contrato', async () => {
  const service = serviceWithClient(async () => ({
    candidates: [
      candidate(),
      candidate({ visiblePrice: undefined }),
      candidate({ productUrl: 'http://example.com/notebook' }),
      candidate({ evidence: [] })
    ]
  }));

  const result = await service.research({ query: 'Notebook', country: 'BR', currency: 'BRL' });

  assert.equal(result.meta.totalCandidatesFound, 4);
  assert.equal(result.meta.validCandidates, 1);
  assert.equal(result.meta.discardedCandidates, 3);
  assert.equal(result.candidates.length, 1);
});

test('productResearchService preserva erro sanitizado do provedor', async () => {
  const privateKey = 'openai-key-privada';
  const service = serviceWithClient(async () => {
    throw new ServiceUnavailableError('OpenAI Responses API retornou resposta indisponivel.', {
      providerName: 'openaiweb',
      statusCode: 429
    });
  });

  await assert.rejects(
    () => service.research({ query: 'Notebook', country: 'BR', currency: 'BRL' }),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.statusCode, 429);
      assert.equal(JSON.stringify(error).includes(privateKey), false);
      return true;
    }
  );
});
