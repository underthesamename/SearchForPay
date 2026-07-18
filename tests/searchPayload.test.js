import test from 'node:test';
import assert from 'node:assert/strict';
import { apiSearchParams } from '../public/searchPayload.js';

test('apiSearchParams nao envia historico ou preferencias locais para a API', () => {
  const params = apiSearchParams({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    comparisonCriteria: 'mais_confiavel',
    history: [{ query: 'Notebook', postalCode: '99999999' }],
    preferences: { postalCode: '88888888' }
  });
  const serialized = params.toString();

  assert.match(serialized, /query=Monitor/);
  assert.match(serialized, /postalCode=01001000/);
  assert.doesNotMatch(serialized, /Notebook|99999999|88888888|mais_confiavel|history|preferences/);
});
