import test from 'node:test';
import assert from 'node:assert/strict';
import { createLomadeeProvider } from '../src/modules/providers/adapters/lomadeeAdapter.js';
import { validateProvider } from '../src/modules/providers/contract.js';
import { ConfigurationError, ServiceUnavailableError } from '../src/shared/errors.js';

const request = Object.freeze({
  query: 'Notebook',
  normalizedQuery: 'notebook',
  context: { postalCode: '01001000', country: 'BR', currency: 'BRL' }
});

test('adapter lomadee cumpre contrato de Provider real', () => {
  const provider = createLomadeeProvider();
  const validation = validateProvider(provider);

  assert.equal(validation.valid, true);
  assert.equal(provider.name, 'lomadee');
  assert.equal(provider.source.type, 'affiliate');
  assert.equal(provider.source.name, 'Lomadee Affiliate Products API');
});

test('adapter lomadee falha com configuracao clara quando falta chave de API', async () => {
  const provider = createLomadeeProvider();

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.providerName, 'lomadee');
      assert.deepEqual(error.details.required, ['LOMADEE_API_KEY']);
      return true;
    }
  );
});

test('adapter lomadee rejeita endpoint nao HTTPS como erro de configuracao', async () => {
  const provider = createLomadeeProvider({
    apiKey: 'token-lomadee-redigido',
    productsBaseUrl: 'http://api.lomadee.test/affiliate/products'
  });

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.providerName, 'lomadee');
      return true;
    }
  );
});

test('adapter lomadee consulta endpoint oficial e normaliza oferta com frete e imposto reais', async () => {
  const seen = {};
  const provider = createLomadeeProvider({
    apiKey: 'token-lomadee-redigido',
    organizationIds: 'e36f5bbb-3e5f-42e2-be4c-6c32dac101c2',
    searchLimit: 12,
    fetchImpl: async (url, options) => {
      seen.url = new URL(String(url));
      seen.headers = options.headers;

      return {
        ok: true,
        async json() {
          return {
            data: [{
              organizationId: 'e36f5bbb-3e5f-42e2-be4c-6c32dac101c2',
              available: true,
              name: 'Notebook Real',
              description: 'Notebook para trabalho',
              url: 'https://loja.example/notebook-real',
              options: [{
                id: 'sku-1',
                name: 'Notebook Real 16GB',
                available: true,
                seller: 'loja-real',
                pricing: [{
                  price: 250000,
                  metadata: [
                    { key: 'shippingCost', value: 1800 },
                    { key: 'taxesAmount', value: 3200 }
                  ]
                }],
                stocks: [{ value: 4 }]
              }]
            }]
          };
        }
      };
    }
  });

  const offers = await provider.search(request);

  assert.equal(seen.url.origin + seen.url.pathname, 'https://api.lomadee.com.br/affiliate/products');
  assert.equal(seen.url.searchParams.get('search'), 'Notebook');
  assert.equal(seen.url.searchParams.get('isAvailable'), 'true');
  assert.equal(seen.url.searchParams.get('limit'), '12');
  assert.equal(seen.url.searchParams.get('organizationIds'), 'e36f5bbb-3e5f-42e2-be4c-6c32dac101c2');
  assert.equal(seen.headers['x-api-key'], 'token-lomadee-redigido');
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerName, 'lomadee');
  assert.equal(offers[0].productTitle, 'Notebook Real 16GB');
  assert.deepEqual(offers[0].price, { amountCents: 250000, currency: 'BRL' });
  assert.deepEqual(offers[0].shipping, { amountCents: 1800, currency: 'BRL' });
  assert.deepEqual(offers[0].taxes, { amountCents: 3200, currency: 'BRL' });
  assert.equal(offers[0].seller.name, 'loja-real');
});

test('adapter lomadee aceita produto sem frete exposto com aviso', async () => {
  const provider = createLomadeeProvider({
    apiKey: 'token-lomadee-redigido',
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          data: [{
            available: true,
            name: 'Notebook Real',
            url: 'https://loja.example/notebook-real',
            options: [{
              name: 'Notebook Real',
              available: true,
              seller: 'loja-real',
              pricing: [{
                price: 250000,
                metadata: [{ key: 'taxesAmount', value: 3200 }]
              }],
              stocks: [{ value: 1 }]
            }]
          }]
        };
      }
    })
  });

  const offers = await provider.search(request);

  assert.equal(offers.length, 1);
  assert.deepEqual(offers[0].shipping, {
    amountCents: 0,
    currency: 'BRL',
    exposed: false,
    warning: 'Frete nao exposto pela Lomadee; compare como subtotal conhecido.'
  });
  assert.deepEqual(offers[0].warnings, ['Frete nao exposto pela Lomadee; compare como subtotal conhecido.']);
});

test('adapter lomadee descarta produto sem imposto real no payload', async () => {
  const provider = createLomadeeProvider({
    apiKey: 'token-lomadee-redigido',
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return {
          data: [{
            available: true,
            name: 'Notebook Real',
            url: 'https://loja.example/notebook-real',
            options: [{
              name: 'Notebook Real',
              available: true,
              seller: 'loja-real',
              pricing: [{ price: 250000 }],
              stocks: [{ value: 1 }]
            }]
          }]
        };
      }
    })
  });

  const offers = await provider.search(request);

  assert.equal(offers.length, 0);
});

test('adapter lomadee sanitiza erro HTTP sem expor chave de API', async () => {
  const apiKey = 'token-lomadee-privado';
  const provider = createLomadeeProvider({
    apiKey,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return { message: apiKey };
      }
    })
  });

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.providerName, 'lomadee');
      assert.equal(error.details.statusCode, 401);
      assert.equal(JSON.stringify(error).includes(apiKey), false);
      return true;
    }
  );
});
