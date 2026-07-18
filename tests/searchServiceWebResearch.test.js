import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductResearchService } from '../src/modules/ai-search/productResearchService.js';
import { createSearchService } from '../src/modules/search/searchService.js';
import { ServiceUnavailableError } from '../src/shared/errors.js';

function registry(providers) {
  return {
    getUnknownProviders: () => [],
    getDisabledProviders: () => [],
    getEnabledProviders: () => providers
  };
}

function candidate(overrides = {}) {
  return {
    productTitle: 'Notebook encontrado na web',
    storeName: 'Fonte web verificavel',
    productUrl: 'https://example.com/notebook-web',
    visiblePrice: { amountCents: 90000, currency: 'BRL' },
    shipping: { exposed: true, amountCents: 1200, currency: 'BRL', warning: null },
    taxes: { exposed: true, amountCents: 800, currency: 'BRL', warning: null },
    evidence: [{
      url: 'https://example.com/notebook-web',
      title: 'Pagina consultada do notebook',
      snippet: 'Trecho curto com evidencia real encontrada pela pesquisa.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'high',
    warnings: [],
    availability: 'available',
    delivery: { minDays: null, maxDays: null },
    ...overrides
  };
}

function openAiResearch(candidates) {
  return createProductResearchService({
    now: () => new Date('2026-07-18T12:00:00.000Z'),
    openAiConfig: {
      enabled: true,
      apiKey: 'openai-key-redigida',
      model: 'gpt-5.6'
    },
    openAiSearchClient: {
      async searchCandidates() {
        return { candidates };
      }
    }
  });
}

function confirmedRevalidation() {
  return {
    async revalidate({ candidate }) {
      return {
        status: 'confirmado',
        lastVerifiedAt: '2026-07-18T12:05:00.000Z',
        currentCandidate: candidate,
        comparisons: {}
      };
    }
  };
}

const input = { query: 'Notebook', context: { postalCode: '01001000', country: 'BR', currency: 'BRL' } };

test('searchService busca em web_research sem depender de providers', async () => {
  const service = createSearchService({
    productResearchService: openAiResearch([candidate()]),
    candidateRevalidationService: confirmedRevalidation()
  });
  const payload = await service.search(input);

  assert.equal(payload.searchMode, 'web_research');
  assert.equal(payload.results.length, 1);
  assert.equal(payload.results[0].model, 'VerifiedOffer');
  assert.equal(payload.results[0].source.type, 'web_search');
  assert.equal(payload.results[0].providerName, 'openaiweb');
  assert.equal(payload.results[0].costCompleteness.complete, true);
  assert.equal(payload.results[0].lastVerifiedAt, '2026-07-18T12:05:00.000Z');
  assert.equal(payload.webCandidates.length, 1);
  assert.equal(payload.meta.rankingSource, 'openai_web_search');
  assert.match(payload.meta.webCandidateRankingRules.warning, /Preco visivel nao e custo total/);
  assert.equal(payload.meta.providersQueried, 0);
  assert.deepEqual(payload.meta.providerReports, []);
});

test('searchMode web_research ignora providers antigos no caminho principal', async () => {
  let legacyProviderCalled = false;
  const service = createSearchService({
    providerRegistry: registry([{
      name: 'marketplace-real',
      source: { type: 'api', name: 'Fonte legada de teste' },
      async search() {
        legacyProviderCalled = true;
        throw new Error('provider legado nao deveria ser chamado');
      }
    }]),
    productResearchService: openAiResearch([candidate()]),
    candidateRevalidationService: confirmedRevalidation()
  });
  const payload = await service.search(input);

  assert.equal(legacyProviderCalled, false);
  assert.equal(payload.results.length, 1);
  assert.equal(payload.meta.rankingSource, 'openai_web_search');
});

test('searchService falha claramente sem OpenAI configurada', async () => {
  const service = createSearchService();

  await assert.rejects(
    () => service.search(input),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.searchMode, 'web_research');
      assert.equal(error.details.webResearch.status, 'disabled');
      assert.match(error.message, /OpenAI Web Search/);
      return true;
    }
  );
});

test('searchService nao ranqueia candidato web sem imposto confirmado', async () => {
  const service = createSearchService({
    productResearchService: openAiResearch([candidate({
      taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao confirmado.' }
    })]),
    candidateRevalidationService: confirmedRevalidation()
  });
  const payload = await service.search(input);

  assert.equal(payload.results.length, 0);
  assert.equal(payload.webCandidates.length, 1);
  assert.equal(payload.webCandidates[0].costCompleteness.complete, false);
  assert.equal(payload.meta.webResearch.verifiedOffers, 0);
});

test('searchService nao ranqueia candidato web sem frete confirmado', async () => {
  const service = createSearchService({
    productResearchService: openAiResearch([candidate({
      shipping: { exposed: false, amountCents: null, currency: null, warning: 'Frete nao exposto.' }
    })]),
    candidateRevalidationService: confirmedRevalidation()
  });
  const payload = await service.search(input);

  assert.equal(payload.results.length, 0);
  assert.equal(payload.webCandidates.length, 1);
  assert.equal(payload.webCandidates[0].costCompleteness.status, 'incomplete');
  assert.equal(payload.meta.webResearch.verifiedOffers, 0);
});
