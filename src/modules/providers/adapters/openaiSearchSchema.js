const evidenceMoneySchema = Object.freeze({
  type: 'object',
  properties: {
    amountCents: { type: ['integer', 'null'] },
    evidenceUrl: { type: ['string', 'null'] },
    evidenceText: { type: ['string', 'null'] }
  },
  required: ['amountCents', 'evidenceUrl', 'evidenceText'],
  additionalProperties: false
});

export const OPENAI_WEB_CANDIDATE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          sellerName: { type: 'string' },
          productUrl: { type: 'string' },
          currency: { type: 'string' },
          availability: { type: 'string' },
          price: evidenceMoneySchema,
          shipping: {
            type: 'object',
            properties: {
              amountCents: { type: ['integer', 'null'] },
              exposed: { type: 'boolean' },
              evidenceUrl: { type: ['string', 'null'] },
              evidenceText: { type: ['string', 'null'] },
              warning: { type: ['string', 'null'] }
            },
            required: ['amountCents', 'exposed', 'evidenceUrl', 'evidenceText', 'warning'],
            additionalProperties: false
          },
          taxes: evidenceMoneySchema,
          delivery: {
            type: 'object',
            properties: {
              minDays: { type: ['integer', 'null'] },
              maxDays: { type: ['integer', 'null'] },
              evidenceUrl: { type: ['string', 'null'] },
              evidenceText: { type: ['string', 'null'] }
            },
            required: ['minDays', 'maxDays', 'evidenceUrl', 'evidenceText'],
            additionalProperties: false
          },
          confidenceLevel: { type: 'string', enum: ['high', 'medium', 'low'] },
          confidenceReasons: { type: 'array', items: { type: 'string' } },
          rejected: { type: 'boolean' },
          rejectionReason: { type: ['string', 'null'] }
        },
        required: [
          'title',
          'sellerName',
          'productUrl',
          'currency',
          'availability',
          'price',
          'shipping',
          'taxes',
          'delivery',
          'confidenceLevel',
          'confidenceReasons',
          'rejected',
          'rejectionReason'
        ],
        additionalProperties: false
      }
    }
  },
  required: ['candidates'],
  additionalProperties: false
});
