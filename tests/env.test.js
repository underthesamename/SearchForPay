import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnv } from '../src/config/env.js';

test('getEnv monta configuracao do provider ebay a partir do ambiente', () => {
  const env = getEnv({
    MARKETPLACE_PROVIDERS: 'ebay,shopify,googlemerchant',
    EBAY_ENVIRONMENT: 'sandbox',
    EBAY_MARKETPLACE_ID: 'EBAY_US',
    EBAY_SEARCH_LIMIT: '5',
    EBAY_REQUEST_TIMEOUT_MS: '2500',
    SHOPIFY_STORE_DOMAIN: 'loja-real.myshopify.com',
    SHOPIFY_SEARCH_LIMIT: '4',
    GOOGLE_MERCHANT_ACCOUNT_ID: '123456',
    GOOGLE_MERCHANT_PAGE_SIZE: '7',
    PRICE_ALERTS_FILE: '.local/alerts.json',
    PRICE_ALERT_JOB_INTERVAL_MS: '30000',
    PRICE_ALERT_RECHECK_INTERVAL_MS: '90000',
    REQUEST_BODY_LIMIT_BYTES: '2048',
    RATE_LIMIT_MAX_REQUESTS: '12',
    SEARCH_CACHE_TTL_MS: '15000',
    SERVER_REQUEST_TIMEOUT_MS: '10000'
  }, {
    loadDotEnv: false
  });

  assert.deepEqual(env.marketplaceProviders, ['ebay', 'shopify', 'googlemerchant']);
  assert.equal(env.providerOptions.ebay.environment, 'sandbox');
  assert.equal(env.providerOptions.ebay.marketplaceId, 'EBAY_US');
  assert.equal(env.providerOptions.ebay.searchLimit, 5);
  assert.equal(env.providerOptions.ebay.requestTimeoutMs, 2500);
  assert.equal(env.providerOptions.shopify.storeDomain, 'loja-real.myshopify.com');
  assert.equal(env.providerOptions.shopify.searchLimit, 4);
  assert.equal(env.providerOptions.googlemerchant.accountId, '123456');
  assert.equal(env.providerOptions.googlemerchant.pageSize, 7);
  assert.equal(env.priceAlertsFile, '.local/alerts.json');
  assert.equal(env.priceAlertJobIntervalMs, 30000);
  assert.equal(env.priceAlertRecheckIntervalMs, 90000);
  assert.equal(env.requestBodyLimitBytes, 2048);
  assert.equal(env.rateLimitMaxRequests, 12);
  assert.equal(env.searchCacheTtlMs, 15000);
  assert.equal(env.serverRequestTimeoutMs, 10000);
});
