import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEB_OFFER_CANDIDATE_MODEL,
  canPromoteWebCandidateToOffer,
  getWebCandidatePromotionBlockers,
  validateWebOfferCandidate
} from '../src/modules/providers/webOfferCandidateModel.js';

function candidate(overrides = {}) {
  return {
    productTitle: 'Notebook validado pelo contrato',
    storeName: 'Fonte de validacao do contrato',
    productUrl: 'https://example.com/notebook-validado',
    visiblePrice: { amountCents: 250000, currency: 'BRL' },
    shipping: { exposed: true, amountCents: 1800, currency: 'BRL', warning: null },
    taxes: { exposed: true, amountCents: 3200, currency: 'BRL', warning: null },
    evidence: [{
      url: 'https://example.com/notebook-validado',
      title: 'Pagina consultada do produto',
      snippet: 'Trecho curto com preco visivel encontrado na fonte consultada.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'high',
    warnings: [],
    availability: 'available',
    delivery: { minDays: null, maxDays: null },
    ...overrides
  };
}

test('WebOfferCandidate valido pode ser promovido quando imposto real esta confirmado', () => {
  const validation = validateWebOfferCandidate(candidate());

  assert.equal(WEB_OFFER_CANDIDATE_MODEL.name, 'WebOfferCandidate');
  assert.equal(validation.valid, true);
  assert.equal(canPromoteWebCandidateToOffer(candidate()), true);
});

test('WebOfferCandidate rejeita URL de produto sem HTTPS', () => {
  const validation = validateWebOfferCandidate(candidate({ productUrl: 'http://example.com/produto' }));

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('productUrl precisa ser HTTPS.'));
});

test('WebOfferCandidate rejeita candidato sem preco visivel', () => {
  const validation = validateWebOfferCandidate(candidate({ visiblePrice: undefined }));

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('visiblePrice ausente.'));
});

test('WebOfferCandidate exige pelo menos uma evidencia clicavel', () => {
  const validation = validateWebOfferCandidate(candidate({ evidence: [] }));

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('evidence precisa ter pelo menos uma fonte clicavel.'));
});

test('WebOfferCandidate aceita frete nao exposto somente sem valor e com aviso', () => {
  const validUnknownShipping = candidate({
    shipping: {
      exposed: false,
      amountCents: null,
      currency: null,
      warning: 'Frete nao exposto pela fonte consultada.'
    }
  });
  const invalidZeroShipping = candidate({
    shipping: {
      exposed: false,
      amountCents: 0,
      currency: 'BRL',
      warning: 'Frete nao exposto pela fonte consultada.'
    }
  });

  assert.equal(validateWebOfferCandidate(validUnknownShipping).valid, true);
  assert.equal(canPromoteWebCandidateToOffer(validUnknownShipping), false);
  assert.ok(getWebCandidatePromotionBlockers(validUnknownShipping).includes('shipping real nao confirmado.'));
  assert.equal(validateWebOfferCandidate(invalidZeroShipping).valid, false);
});

test('WebOfferCandidate com imposto ausente nao vira oferta valida ranqueavel', () => {
  const withoutTaxes = candidate({
    taxes: {
      exposed: false,
      amountCents: null,
      currency: null,
      warning: 'Imposto nao confirmado pela fonte consultada.'
    }
  });
  const validation = validateWebOfferCandidate(withoutTaxes);
  const blockers = getWebCandidatePromotionBlockers(withoutTaxes);

  assert.equal(validation.valid, true);
  assert.equal(canPromoteWebCandidateToOffer(withoutTaxes), false);
  assert.ok(blockers.includes('taxes real nao confirmado.'));
});

test('WebOfferCandidate rejeita imposto ausente sem aviso explicito', () => {
  const validation = validateWebOfferCandidate(candidate({
    taxes: {
      exposed: false,
      amountCents: null,
      currency: null,
      warning: ''
    }
  }));

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('taxes.warning ausente para imposto nao confirmado.'));
});
