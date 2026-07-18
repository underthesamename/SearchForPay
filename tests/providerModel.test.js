import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProvider } from '../src/modules/providers/contract.js';

test('validateProvider exige nome, origem real e funcao de busca', () => {
  const validation = validateProvider({
    name: 'marketplace-real',
    source: {
      type: 'api',
      name: 'Fonte de teste do contrato'
    },
    async search() {
      return [];
    }
  });

  assert.equal(validation.valid, true);
});

test('validateProvider rejeita adaptador sem origem real', () => {
  const validation = validateProvider({
    name: 'marketplace-real',
    async search() {
      return [];
    }
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('source ausente.'));
});
