import test from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleMerchantProvider } from '../src/modules/providers/adapters/googleMerchantAdapter.js';
import { validateProvider } from '../src/modules/providers/contract.js';
import { ConfigurationError, ServiceUnavailableError } from '../src/shared/errors.js';

const request = Object.freeze({
  query: 'Monitor',
  normalizedQuery: 'monitor',
  context: { postalCode: '94114', country: 'US', currency: 'USD' }
});

test('adapter googlemerchant cumpre contrato de Provider real', () => {
  const provider = createGoogleMerchantProvider();
  const validation = validateProvider(provider);

  assert.equal(validation.valid, true);
  assert.equal(provider.name, 'googlemerchant');
  assert.equal(provider.source.type, 'api');
  assert.equal(provider.source.name, 'Google Merchant API');
});

test('adapter googlemerchant falha com configuracao clara quando falta credencial', async () => {
  const provider = createGoogleMerchantProvider();

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.providerName, 'googlemerchant');
      assert.deepEqual(error.details.required, ['GOOGLE_MERCHANT_ACCOUNT_ID', 'GOOGLE_MERCHANT_ACCESS_TOKEN']);
      return true;
    }
  );
});

test('adapter googlemerchant normaliza produto, frete e imposto dos atributos', async () => {
  const provider = createGoogleMerchantProvider({
    accountId: '123456',
    accessToken: 'token-redigido-google',
    fetchImpl: async (url) => {
      if (String(url).includes('/accounts/123456/products')) {
        return {
          ok: true,
          async json() {
            return {
              products: [{
                attributes: {
                  title: 'Monitor Real',
                  description: 'Monitor para trabalho',
                  link: 'https://merchant.example/products/monitor-real',
                  price: { amountMicros: '100000000', currencyCode: 'USD' },
                  shipping: [{
                    country: 'US', postalCode: '94*', price: { amountMicros: '9000000', currencyCode: 'USD' },
                    minHandlingTime: '1', maxHandlingTime: '2', minTransitTime: '3', maxTransitTime: '5'
                  }],
                  taxes: [{ country: 'US', postalCode: '94114', rate: 8.5, taxShip: true }]
                }
              }]
            };
          }
        };
      }

      return {
        ok: true,
        async json() {
          return { accountName: 'Conta Merchant Real' };
        }
      };
    }
  });

  const offers = await provider.search(request);

  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerName, 'googlemerchant');
  assert.equal(offers[0].seller.name, 'Conta Merchant Real');
  assert.deepEqual(offers[0].price, { amountCents: 10000, currency: 'USD' });
  assert.deepEqual(offers[0].shipping, { amountCents: 900, currency: 'USD' });
  assert.equal(offers[0].taxes.amountCents, 927);
  assert.deepEqual(offers[0].delivery, { minDays: 4, maxDays: 7 });
});

test('adapter googlemerchant descarta produto sem imposto aplicavel', async () => {
  const provider = createGoogleMerchantProvider({
    accountId: '123456',
    accessToken: 'token-redigido-google',
    fetchImpl: async (url) => ({
      ok: true,
      async json() {
        if (String(url).includes('/products')) {
          return {
            products: [{
              attributes: {
                title: 'Monitor Real',
                link: 'https://merchant.example/products/monitor-real',
                price: { amountMicros: '100000000', currencyCode: 'USD' },
                shipping: [{
                  country: 'US',
                  price: { amountMicros: '9000000', currencyCode: 'USD' }
                }]
              }
            }]
          };
        }

        return { accountName: 'Conta Merchant Real' };
      }
    })
  });

  const offers = await provider.search(request);

  assert.equal(offers.length, 0);
});

test('adapter googlemerchant sanitiza erro HTTP sem expor token', async () => {
  const token = 'token-redigido-google-privado';
  const provider = createGoogleMerchantProvider({
    accountId: '123456',
    accessToken: token,
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      async json() {
        return {};
      }
    })
  });

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.providerName, 'googlemerchant');
      assert.equal(error.details.statusCode, 403);
      assert.equal(JSON.stringify(error).includes(token), false);
      return true;
    }
  );
});
