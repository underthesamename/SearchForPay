import test from 'node:test';
import assert from 'node:assert/strict';
import { getEnv } from '../src/config/env.js';

test('getEnv monta configuracao do provider ebay a partir do ambiente', () => {
  const env = getEnv({
    MARKETPLACE_PROVIDERS: 'ebay,shopify,googlemerchant,lomadee,openaiweb',
    EBAY_ENVIRONMENT: 'sandbox',
    EBAY_MARKETPLACE_ID: 'EBAY_US',
    EBAY_SEARCH_LIMIT: '5',
    EBAY_REQUEST_TIMEOUT_MS: '2500',
    SHOPIFY_STORE_DOMAIN: 'loja-real.myshopify.com',
    SHOPIFY_SEARCH_LIMIT: '4',
    GOOGLE_MERCHANT_ACCOUNT_ID: '123456',
    GOOGLE_MERCHANT_PAGE_SIZE: '7',
    LOMADEE_API_KEY: 'lomadee-key-redigida',
    LOMADEE_ORGANIZATION_IDS: 'e36f5bbb-3e5f-42e2-be4c-6c32dac101c2',
    LOMADEE_SEARCH_LIMIT: '13',
    OPENAI_API_KEY: 'openai-key-redigida',
    OPENAI_SEARCH_ENABLED: 'true',
    OPENAI_SEARCH_MODEL: 'gpt-5.6',
    OPENAI_SEARCH_CONTEXT_SIZE: 'medium',
    OPENAI_SEARCH_MAX_CANDIDATES: '8',
    OPENAI_SEARCH_TIMEOUT_MS: '3500',
    OPENAI_SEARCH_RATE_LIMIT_WINDOW_MS: '20000',
    OPENAI_SEARCH_RATE_LIMIT_MAX_REQUESTS: '9',
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

  assert.deepEqual(env.marketplaceProviders, ['ebay', 'shopify', 'googlemerchant', 'lomadee', 'openaiweb']);
  assert.equal(env.providerOptions.ebay.environment, 'sandbox');
  assert.equal(env.providerOptions.ebay.marketplaceId, 'EBAY_US');
  assert.equal(env.providerOptions.ebay.searchLimit, 5);
  assert.equal(env.providerOptions.ebay.requestTimeoutMs, 2500);
  assert.equal(env.providerOptions.shopify.storeDomain, 'loja-real.myshopify.com');
  assert.equal(env.providerOptions.shopify.searchLimit, 4);
  assert.equal(env.providerOptions.googlemerchant.accountId, '123456');
  assert.equal(env.providerOptions.googlemerchant.pageSize, 7);
  assert.equal(env.providerOptions.lomadee.apiKey, 'lomadee-key-redigida');
  assert.equal(env.providerOptions.lomadee.organizationIds, 'e36f5bbb-3e5f-42e2-be4c-6c32dac101c2');
  assert.equal(env.providerOptions.lomadee.searchLimit, 13);
  assert.equal(env.providerOptions.openaiweb.apiKey, 'openai-key-redigida');
  assert.equal(env.providerOptions.openaiweb.enabled, true);
  assert.equal(env.providerOptions.openaiweb.model, 'gpt-5.6');
  assert.equal(env.providerOptions.openaiweb.contextSize, 'medium');
  assert.equal(env.providerOptions.openaiweb.maxCandidates, 8);
  assert.equal(env.providerOptions.openaiweb.requestTimeoutMs, 3500);
  assert.equal(env.providerOptions.openaiweb.rateLimitWindowMs, 20000);
  assert.equal(env.providerOptions.openaiweb.rateLimitMaxRequests, 9);
  assert.equal(env.priceAlertsFile, '.local/alerts.json');
  assert.equal(env.priceAlertJobIntervalMs, 30000);
  assert.equal(env.priceAlertRecheckIntervalMs, 90000);
  assert.equal(env.requestBodyLimitBytes, 2048);
  assert.equal(env.rateLimitMaxRequests, 12);
  assert.equal(env.searchCacheTtlMs, 15000);
  assert.equal(env.serverRequestTimeoutMs, 10000);
});

test('getEnv deixa OpenAI Search desativada por padrao sem chave real', () => {
  const env = getEnv({
    MARKETPLACE_PROVIDERS: 'openaiweb'
  }, {
    loadDotEnv: false
  });

  assert.deepEqual(env.marketplaceProviders, ['openaiweb']);
  assert.equal(env.providerOptions.openaiweb.enabled, false);
  assert.equal(env.providerOptions.openaiweb.apiKey, '');
  assert.equal(env.providerOptions.openaiweb.disabledReason, 'OPENAI_SEARCH_ENABLED=false.');
  assert.equal(env.providerOptions.openaiweb.model, 'gpt-5.6');
  assert.equal(env.providerOptions.openaiweb.contextSize, 'high');
  assert.equal(env.providerOptions.openaiweb.maxCandidates, 8);
  assert.equal(env.providerOptions.openaiweb.requestTimeoutMs, 15000);
  assert.equal(env.providerOptions.openaiweb.rateLimitWindowMs, 60000);
  assert.equal(env.providerOptions.openaiweb.rateLimitMaxRequests, 30);
});

test('getEnv nao ativa OpenAI Search quando flag esta true mas falta chave', () => {
  const env = getEnv({
    MARKETPLACE_PROVIDERS: 'openaiweb',
    OPENAI_SEARCH_ENABLED: 'true'
  }, {
    loadDotEnv: false
  });

  assert.equal(env.providerOptions.openaiweb.enabled, false);
  assert.equal(env.providerOptions.openaiweb.disabledReason, 'OPENAI_API_KEY ausente.');
});
