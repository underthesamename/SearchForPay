import { hasText, isHttpsUrl, isPlainObject } from './contractUtils.js';

export const SEARCH_EVIDENCE_MODEL = Object.freeze({
  name: 'SearchEvidence',
  version: 1,
  requiredFields: Object.freeze(['url', 'title', 'snippet', 'accessedAt'])
});

export function validateSearchEvidence(evidence) {
  const errors = [];

  if (!isPlainObject(evidence)) {
    return { valid: false, errors: ['SearchEvidence invalida.'] };
  }

  if (!isHttpsUrl(evidence.url)) errors.push('evidence.url precisa ser HTTPS.');
  if (!hasText(evidence.title)) errors.push('evidence.title ausente.');
  if (!hasText(evidence.snippet) || evidence.snippet.trim().length > 360) {
    errors.push('evidence.snippet ausente ou longo demais.');
  }
  if (!hasText(evidence.accessedAt) || Number.isNaN(Date.parse(evidence.accessedAt))) {
    errors.push('evidence.accessedAt invalido.');
  }

  return { valid: errors.length === 0, errors };
}
