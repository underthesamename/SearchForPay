import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopifyStorefrontProvider } from '../src/modules/providers/adapters/shopifyStorefrontAdapter.js';
import { validateProvider } from '../src/modules/providers/contract.js';
import { ConfigurationError, ServiceUnavailableError } from '../src/shared/errors.js';

const request = Object.freeze({
  query: 'Monitor',
  normalizedQuery: 'monitor',
  context: { postalCode: '10001', country: 'US', currency: 'USD' }
});

test('adapter shopify cumpre contrato de Provider real', () => {
  const provider = createShopifyStorefrontProvider();
  const validation = validateProvider(provider);

  assert.equal(validation.valid, true);
  assert.equal(provider.name, 'shopify');
  assert.equal(provider.source.type, 'api');
  assert.equal(provider.source.name, 'Shopify Storefront API');
});

test('adapter shopify falha com configuracao clara quando falta credencial', async () => {
  const provider = createShopifyStorefrontProvider();

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ConfigurationError);
      assert.equal(error.details.providerName, 'shopify');
      assert.deepEqual(error.details.required, ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_STOREFRONT_ACCESS_TOKEN']);
      return true;
    }
  );
});

test('adapter shopify normaliza produto, frete e imposto do carrinho', async () => {
  const calls = [];
  const provider = createShopifyStorefrontProvider({
    storeDomain: 'loja-real.myshopify.com',
    accessToken: 'token-redigido-shopify',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body.query);

      if (body.query.includes('SearchForPayProducts')) {
        return {
          ok: true,
          async json() {
            return {
              data: {
                shop: { name: 'Loja Real' },
                products: {
                  edges: [{
                    node: {
                      title: 'Monitor Real',
                      onlineStoreUrl: 'https://loja-real.example/products/monitor-real',
                      variants: {
                        edges: [{
                          node: {
                            id: 'gid://shopify/ProductVariant/1',
                            availableForSale: true,
                            price: { amount: '100.00', currencyCode: 'USD' }
                          }
                        }]
                      }
                    }
                  }]
                }
              }
            };
          }
        };
      }

      return {
        ok: true,
        async json() {
          return {
            data: {
              cartCreate: {
                cart: {
                  checkoutUrl: 'https://loja-real.example/cart/c/1',
                  cost: {
                    subtotalAmount: { amount: '100.00', currencyCode: 'USD' },
                    totalTaxAmount: { amount: '8.25', currencyCode: 'USD' }
                  },
                  deliveryGroups: {
                    edges: [{
                      node: {
                        deliveryOptions: [{
                          title: 'Entrega Real',
                          estimatedCost: { amount: '12.00', currencyCode: 'USD' }
                        }]
                      }
                    }]
                  }
                },
                userErrors: []
              }
            }
          };
        }
      };
    }
  });

  const offers = await provider.search(request);

  assert.equal(calls.length, 2);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].providerName, 'shopify');
  assert.equal(offers[0].seller.name, 'Loja Real');
  assert.deepEqual(offers[0].price, { amountCents: 10000, currency: 'USD' });
  assert.deepEqual(offers[0].shipping, { amountCents: 1200, currency: 'USD' });
  assert.deepEqual(offers[0].taxes, { amountCents: 825, currency: 'USD' });
});

test('adapter shopify sanitiza erro HTTP sem expor token', async () => {
  const token = 'token-redigido-shopify-privado';
  const provider = createShopifyStorefrontProvider({
    storeDomain: 'loja-real.myshopify.com',
    accessToken: token,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() {
        return {};
      }
    })
  });

  await assert.rejects(
    () => provider.search(request),
    (error) => {
      assert.ok(error instanceof ServiceUnavailableError);
      assert.equal(error.details.providerName, 'shopify');
      assert.equal(error.details.statusCode, 401);
      assert.equal(JSON.stringify(error).includes(token), false);
      return true;
    }
  );
});
