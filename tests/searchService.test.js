import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchService } from '../src/modules/search/searchService.js';
import { ConfigurationError, ServiceUnavailableError } from '../src/shared/errors.js';

function registry(providers) {
  return {
    getUnknownProviders() {
      return [];
    },

    getEnabledProviders() {
      return providers;
    }
  };
}

function provider(overrides) {
  return {
    name: 'marketplace-real',
    source: {
      type: 'api',
      name: 'Fonte de teste do contrato'
    },
    async search() {
      return [];
    },
    ...overrides
  };
}

function validOffer(overrides) {
  return {
    providerName: 'marketplace-real',
    source: { type: 'api', name: 'Fonte de teste do contrato' },
    productTitle: 'Produto de teste do contrato',
    productUrl: 'https://example.com/produto-contrato',
    price: { amountCents: 10000, currency: 'BRL' },
    shipping: { amountCents: 1000, currency: 'BRL' },
    taxes: { amountCents: 0, currency: 'BRL' },
    seller: { name: 'Loja de teste do contrato' },
    ...overrides
  };
}

test('searchService rejeita busca sem provedor real', async () => {
  const service = createSearchService({
    providerRegistry: registry([])
  });

  await assert.rejects(
    () => service.search({ query: 'notebook', context: { postalCode: '01001000', country: 'BR' } }),
    ServiceUnavailableError
  );
});

test('searchService normaliza termo e envia CEP, pais e moeda ao provedor', async () => {
  let receivedRequest;
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search(request) {
          receivedRequest = request;
          return [];
        }
      })
    ])
  });

  const payload = await service.search({
    query: '  Monitor    Gamer  ',
    postalCode: ' 01001-000 ',
    country: 'br',
    currency: 'brl'
  });

  assert.equal(payload.query, 'Monitor Gamer');
  assert.equal(payload.normalizedQuery, 'monitor gamer');
  assert.equal(payload.context.postalCode, '01001-000');
  assert.equal(payload.context.country, 'BR');
  assert.equal(payload.context.currency, 'BRL');
  assert.equal(payload.meta.normalizedQuery, 'monitor gamer');
  assert.equal(payload.meta.currency, 'BRL');
  assert.deepEqual(receivedRequest, {
    query: 'Monitor Gamer',
    normalizedQuery: 'monitor gamer',
    context: {
      postalCode: '01001-000',
      country: 'BR',
      currency: 'BRL'
    }
  });
});

test('searchService preserva nome do provedor quando adaptador falha', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        name: 'marketplace-real',
        async search() {
          throw new Error('falha privada do provedor');
        }
      })
    ])
  });

  await assert.rejects(
    () => service.search({ query: 'monitor', context: { postalCode: '01001000', country: 'BR' } }),
    (error) => {
      assert.equal(error.details.providers[0].providerName, 'marketplace-real');
      assert.equal(error.details.providers[0].status, 'failed');
      assert.equal(error.details.providers[0].message, 'Provedor indisponivel ou resposta invalida.');
      return true;
    }
  );
});

test('searchService reporta erro de configuracao do provedor sem segredo bruto', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search() {
          throw new ConfigurationError('Credenciais do provedor real ausentes.', {
            providerName: 'marketplace-real',
            required: ['MARKETPLACE_CLIENT_ID', 'MARKETPLACE_CLIENT_SECRET']
          });
        }
      })
    ])
  });

  await assert.rejects(
    () => service.search({ query: 'monitor', context: { postalCode: '01001000', country: 'BR' } }),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.providers[0].providerName, 'marketplace-real');
      assert.equal(error.details.providers[0].status, 'configuration_error');
      assert.equal(error.details.providers[0].message, 'Credenciais do provedor real ausentes.');
      assert.deepEqual(error.details.providers[0].details.required, [
        'MARKETPLACE_CLIENT_ID',
        'MARKETPLACE_CLIENT_SECRET'
      ]);
      return true;
    }
  );
});

test('searchService ignora oferta sem loja ou origem real', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search() {
          return [
            {
              providerName: 'marketplace-real',
              productTitle: 'Produto sem contrato completo',
              productUrl: 'https://example.com/produto',
              price: { amountCents: 10000, currency: 'BRL' },
              shipping: { amountCents: 1000, currency: 'BRL' },
              taxes: { amountCents: 0, currency: 'BRL' }
            }
          ];
        }
      })
    ])
  });

  const payload = await service.search({
    query: 'monitor',
    context: { postalCode: '01001000', country: 'BR' }
  });

  assert.equal(payload.results.length, 0);
  assert.equal(payload.meta.invalidOffersIgnored, 1);
  assert.equal(payload.meta.providerReports[0].offersReceived, 1);
  assert.equal(payload.meta.providerReports[0].validOffers, 0);
  assert.equal(payload.meta.providerReports[0].invalidOffers, 1);
});

test('searchService rejeita oferta com providerName diferente do provedor configurado', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search() {
          return [
            {
              providerName: 'outro-provedor',
              source: { type: 'api', name: 'Fonte de teste do contrato' },
              productTitle: 'Produto com origem divergente',
              productUrl: 'https://example.com/produto',
              price: { amountCents: 10000, currency: 'BRL' },
              shipping: { amountCents: 1000, currency: 'BRL' },
              taxes: { amountCents: 0, currency: 'BRL' },
              seller: { name: 'Loja de teste do contrato' }
            }
          ];
        }
      })
    ])
  });

  const payload = await service.search({
    query: 'monitor',
    context: { postalCode: '01001000', country: 'BR' }
  });

  assert.equal(payload.results.length, 0);
  assert.equal(payload.meta.invalidOffersIgnored, 1);
});

test('searchService ignora oferta em moeda diferente do contexto', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search() {
          return [
            validOffer({
              price: { amountCents: 10000, currency: 'USD' },
              shipping: { amountCents: 1000, currency: 'USD' },
              taxes: { amountCents: 0, currency: 'USD' }
            })
          ];
        }
      })
    ])
  });

  const payload = await service.search({
    query: 'monitor',
    context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
  });

  assert.equal(payload.results.length, 0);
  assert.equal(payload.meta.invalidOffersIgnored, 1);
  assert.equal(payload.meta.providerReports[0].invalidOffers, 1);
});

test('searchService retorna oferta valida e relatorio por provedor', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search() {
          return [validOffer()];
        }
      })
    ])
  });

  const payload = await service.search({
    query: 'monitor',
    context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
  });

  assert.equal(payload.results.length, 1);
  assert.equal(payload.meta.providerReports[0].status, 'ok');
  assert.equal(payload.meta.providerReports[0].offersReceived, 1);
  assert.equal(payload.meta.providerReports[0].validOffers, 1);
  assert.equal(payload.meta.providerReports[0].invalidOffers, 0);
});

test('searchService preserva relatorio web sanitizado sem dados pessoais', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search() {
          return {
            offers: [validOffer()],
            report: {
              candidatesExtracted: 2,
              candidatesRejected: 1,
              verificationLayer: 'web_search',
              postalCode: '01001000'
            }
          };
        }
      })
    ])
  });

  const payload = await service.search({
    query: 'monitor',
    context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
  });

  assert.equal(payload.results.length, 1);
  assert.equal(payload.meta.providerReports[0].candidatesExtracted, 2);
  assert.equal(payload.meta.providerReports[0].candidatesRejected, 1);
  assert.equal(payload.meta.providerReports[0].verificationLayer, 'web_search');
  assert.equal(payload.meta.providerReports[0].postalCode, undefined);
});

test('searchService mantem busca quando um provedor falha e outro retorna oferta valida', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        name: 'provedor-instavel',
        async search() {
          throw new Error('falha privada do provedor');
        }
      }),
      provider({
        name: 'marketplace-real',
        async search() {
          return [validOffer()];
        }
      })
    ])
  });

  const payload = await service.search({
    query: 'monitor',
    context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
  });

  assert.equal(payload.results.length, 1);
  assert.equal(payload.meta.providerReports.length, 2);
  assert.equal(payload.meta.providerReports[0].providerName, 'provedor-instavel');
  assert.equal(payload.meta.providerReports[0].status, 'failed');
  assert.equal(payload.meta.providerReports[1].providerName, 'marketplace-real');
  assert.equal(payload.meta.providerReports[1].status, 'ok');
});

test('searchService retorna no maximo top 3 ofertas com explicacao curta', async () => {
  const service = createSearchService({
    providerRegistry: registry([
      provider({
        async search() {
          return [
            validOffer({
              productTitle: 'Opcao 4',
              price: { amountCents: 13000, currency: 'BRL' }
            }),
            validOffer({
              productTitle: 'Opcao 1',
              price: { amountCents: 10000, currency: 'BRL' }
            }),
            validOffer({
              productTitle: 'Opcao 3',
              price: { amountCents: 12000, currency: 'BRL' }
            }),
            validOffer({
              productTitle: 'Opcao 2',
              price: { amountCents: 11000, currency: 'BRL' }
            })
          ];
        }
      })
    ]),
    maxResults: 10
  });

  const payload = await service.search({
    query: 'monitor',
    context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
  });

  assert.equal(payload.results.length, 3);
  assert.deepEqual(payload.results.map((item) => item.productTitle), ['Opcao 1', 'Opcao 2', 'Opcao 3']);
  assert.deepEqual(payload.results.map((item) => item.ranking.position), [1, 2, 3]);
  assert.ok(payload.results.every((item) => item.ranking.explanation.includes('custo total')));
  assert.equal(payload.meta.rankingRules.maxResults, 3);
});
