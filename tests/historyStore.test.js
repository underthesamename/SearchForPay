import test from 'node:test';
import assert from 'node:assert/strict';
import { createSearchMemory, maskPostalCode } from '../public/historyStore.js';

function createStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
}

test('historico local salva ultimas buscas e preferencias reutilizaveis', () => {
  const memory = createSearchMemory(createStorage());

  memory.saveSearch({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    comparisonCriteria: 'mais_confiavel'
  });

  const history = memory.loadHistory();
  const preferences = memory.loadPreferences();

  assert.equal(history.length, 1);
  assert.equal(history[0].query, 'Monitor');
  assert.equal(history[0].postalCode, '01001000');
  assert.equal(history[0].comparisonCriteria, 'mais_confiavel');
  assert.equal(preferences.postalCode, '01001000');
  assert.equal(preferences.country, 'BR');
  assert.equal(preferences.currency, 'BRL');
  assert.equal(preferences.comparisonCriteria, 'mais_confiavel');
  assert.equal('query' in preferences, false);
});

test('historico local deduplica busca e limita tamanho', () => {
  const memory = createSearchMemory(createStorage());

  for (let index = 0; index < 8; index += 1) {
    memory.saveSearch({
      query: `Produto ${index}`,
      postalCode: '01001000',
      country: 'BR',
      currency: 'BRL'
    });
  }

  memory.saveSearch({
    query: 'Produto 7',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL'
  });

  const history = memory.loadHistory();

  assert.equal(history.length, 6);
  assert.equal(history[0].query, 'Produto 7');
});

test('historico local permite apagar historico sem apagar preferencias', () => {
  const memory = createSearchMemory(createStorage());

  memory.saveSearch({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'BR',
    currency: 'BRL',
    comparisonCriteria: 'menor_prazo'
  });

  assert.equal(memory.clearHistory().length, 0);
  assert.equal(memory.loadHistory().length, 0);
  assert.equal(memory.loadPreferences().comparisonCriteria, 'menor_prazo');
});

test('historico local mascara CEP em resumos de UI', () => {
  assert.equal(maskPostalCode('01001000'), 'CEP final 000');
});

test('historico local ignora pais ou moeda fora das opcoes suportadas', () => {
  const memory = createSearchMemory(createStorage());

  memory.saveSearch({
    query: 'Monitor',
    postalCode: '01001000',
    country: 'ZZ',
    currency: 'ZZZ'
  });

  assert.equal(memory.loadHistory().length, 0);
  assert.equal(memory.loadPreferences(), undefined);
});
