const nullableText = Object.freeze({ type: ['string', 'null'] });
const nullableInteger = Object.freeze({ type: ['integer', 'null'] });

const moneyCandidateSchema = Object.freeze({
  type: 'object',
  properties: {
    amountCents: { type: 'integer' },
    currency: { type: 'string' }
  },
  required: ['amountCents', 'currency'],
  additionalProperties: false
});

const optionalCostSchema = Object.freeze({
  type: 'object',
  properties: {
    exposed: { type: 'boolean' },
    amountCents: nullableInteger,
    currency: nullableText,
    warning: nullableText
  },
  required: ['exposed', 'amountCents', 'currency', 'warning'],
  additionalProperties: false
});

const evidenceSchema = Object.freeze({
  type: 'object',
  properties: {
    url: { type: 'string' },
    title: { type: 'string' },
    snippet: { type: 'string' },
    accessedAt: { type: 'string' }
  },
  required: ['url', 'title', 'snippet', 'accessedAt'],
  additionalProperties: false
});

const researchSchema = Object.freeze({
  type: 'object',
  properties: {
    searchMode: { type: 'string', enum: ['web_research'] },
    productQuery: { type: 'string' },
    searchedQueries: {
      type: 'array',
      maxItems: 8,
      items: { type: 'string' }
    },
    sourcesSearched: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string' }
    },
    generatedAt: { type: 'string' },
    warnings: {
      type: 'array',
      maxItems: 20,
      items: { type: 'string' }
    }
  },
  required: [
    'searchMode',
    'productQuery',
    'searchedQueries',
    'sourcesSearched',
    'generatedAt',
    'warnings'
  ],
  additionalProperties: false
});

export const OPENAI_WEB_CANDIDATE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    research: researchSchema,
    candidates: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          productTitle: { type: 'string' },
          storeName: { type: 'string' },
          productUrl: { type: 'string' },
          visiblePrice: moneyCandidateSchema,
          shipping: optionalCostSchema,
          taxes: optionalCostSchema,
          evidence: {
            type: 'array',
            minItems: 1,
            maxItems: 5,
            items: evidenceSchema
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          warnings: { type: 'array', items: { type: 'string' } },
          availability: { type: 'string' },
          delivery: {
            type: 'object',
            properties: {
              minDays: nullableInteger,
              maxDays: nullableInteger
            },
            required: ['minDays', 'maxDays'],
            additionalProperties: false
          }
        },
        required: [
          'productTitle',
          'storeName',
          'productUrl',
          'visiblePrice',
          'shipping',
          'taxes',
          'evidence',
          'confidence',
          'warnings',
          'availability',
          'delivery'
        ],
        additionalProperties: false
      }
    }
  },
  required: ['research', 'candidates'],
  additionalProperties: false
});
