import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../src/modules/providers/providerRegistry.js';

test('providerRegistry mantem openaiweb desativado sem flag e chave', () => {
  const registry = createProviderRegistry({
    providerNames: ['openaiweb'],
    providerOptions: {
      openaiweb: {
        enabled: false,
        disabledReason: 'OPENAI_SEARCH_ENABLED=false.'
      }
    }
  });

  assert.deepEqual(registry.getConfiguredProviderNames(), ['openaiweb']);
  assert.deepEqual(registry.getEnabledProviderNames(), []);
  assert.deepEqual(registry.getDisabledProviders(), [
    { providerName: 'openaiweb', reason: 'OPENAI_SEARCH_ENABLED=false.' }
  ]);
});

test('providerRegistry ativa openaiweb somente quando config permite', () => {
  const registry = createProviderRegistry({
    providerNames: ['openaiweb'],
    providerOptions: {
      openaiweb: {
        enabled: true,
        apiKey: 'openai-key-redigida',
        contextSize: 'high',
        maxCandidates: 8
      }
    }
  });

  assert.deepEqual(registry.getDisabledProviders(), []);
  assert.deepEqual(registry.getEnabledProviderNames(), ['openaiweb']);
});
