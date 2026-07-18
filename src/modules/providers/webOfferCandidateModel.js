export const WEB_OFFER_CANDIDATE_MODEL = Object.freeze({
  name: 'WebOfferCandidate',
  version: 1,
  requiredFields: Object.freeze([
    'productTitle',
    'storeName',
    'productUrl',
    'visiblePrice.amountCents',
    'visiblePrice.currency',
    'shipping.exposed',
    'shipping.warning',
    'taxes.exposed',
    'taxes.warning',
    'evidence[].url',
    'evidence[].title',
    'evidence[].snippet',
    'evidence[].accessedAt',
    'confidence',
    'warnings'
  ]),
  promotionRule: 'Candidate only becomes an Offer when real tax is confirmed; unknown shipping stays incomplete.'
});

export {
  canPromoteWebCandidateToOffer,
  getWebCandidatePromotionBlockers,
  validateWebOfferCandidate
} from './webOfferCandidateValidation.js';
