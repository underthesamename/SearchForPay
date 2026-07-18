import { createProductResearchService } from './productResearchService.js';
import { ValidationError } from '../../shared/errors.js';
import {
  createCostCompletenessFromWebCandidate,
  isUnavailableText,
  REVALIDATION_STATUSES
} from '../search/searchContracts.js';
import { cleanText, isHttpsUrl, isPlainObject } from '../search/contractUtils.js';

function money(value) {
  if (!isPlainObject(value) || !Number.isInteger(value.amountCents)) return undefined;
  return { amountCents: value.amountCents, currency: value.currency };
}
function cost(value) {
  if (!isPlainObject(value)) return { exposed: false, amountCents: null, currency: null };
  if (value.exposed === false) return { exposed: false, amountCents: null, currency: null };
  const parsed = money(value);
  return parsed ? { exposed: true, ...parsed } : { exposed: false, amountCents: null, currency: null };
}
function evidenceList(value) {
  return (Array.isArray(value) ? value : [])
    .filter((item) => isHttpsUrl(item?.url))
    .slice(0, 5)
    .map((item) => ({
      url: item.url,
      title: cleanText(item.title || item.url),
      snippet: cleanText(item.snippet || 'Evidencia anterior.', 360),
      accessedAt: item.accessedAt
    }));
}
function snapshot(input = {}) {
  const source = input.candidate || input.offer || input;
  const price = source.visiblePrice || source.price;

  return {
    productTitle: cleanText(source.productTitle || input.query || source.productUrl),
    storeName: cleanText(source.storeName || source.seller?.name),
    productUrl: cleanText(source.productUrl, 500),
    visiblePrice: money(price),
    shipping: cost(source.shipping),
    taxes: cost(source.taxes),
    availability: cleanText(source.availability || 'precisa confirmacao'),
    evidence: evidenceList(source.evidence || source.verification?.evidence || input.evidence)
  };
}
function assertSnapshot(value) {
  if (!isHttpsUrl(value.productUrl)) {
    throw new ValidationError('Revalidacao exige productUrl HTTPS.');
  }
  if (value.evidence.length === 0) {
    throw new ValidationError('Revalidacao exige evidencia HTTPS anterior.');
  }
}
function compareMoney(previous, current) {
  const before = money(previous);
  const after = money(current);

  return {
    previous: before || null,
    current: after || null,
    comparable: Boolean(before && after),
    changed: before && after ? before.amountCents !== after.amountCents || before.currency !== after.currency : null
  };
}
function compareCost(previous, current) {
  const before = cost(previous);
  const after = cost(current);
  const comparable = before.exposed === true && after.exposed === true;

  return {
    previous: before,
    current: after,
    comparable,
    changed: comparable ? before.amountCents !== after.amountCents || before.currency !== after.currency : null
  };
}

function compareText(previous, current) {
  const before = cleanText(previous).toLowerCase();
  const after = cleanText(current).toLowerCase();
  return { previous: previous || null, current: current || null, comparable: Boolean(before && after), changed: before && after ? before !== after : null };
}

function matchingCandidate(candidates, originalUrl) {
  return candidates.find((candidate) => candidate.productUrl === originalUrl);
}

function resultStatus(candidate, comparisons) {
  if (!candidate) return REVALIDATION_STATUSES.NOT_VERIFIABLE;
  if (isUnavailableText(candidate.availability)) return REVALIDATION_STATUSES.UNAVAILABLE;
  if (createCostCompletenessFromWebCandidate(candidate).complete !== true) return REVALIDATION_STATUSES.INCOMPLETE;
  if (Object.values(comparisons).some((comparison) => comparison.changed === true)) return REVALIDATION_STATUSES.CHANGED;
  return REVALIDATION_STATUSES.CONFIRMED;
}

function comparisons(previous, current) {
  return {
    price: compareMoney(previous.visiblePrice, current.visiblePrice),
    shipping: compareCost(previous.shipping, current.shipping),
    taxes: compareCost(previous.taxes, current.taxes),
    availability: compareText(previous.availability, current.availability),
    store: compareText(previous.storeName, current.storeName)
  };
}

export function createCandidateRevalidationService(options = {}) {
  const now = options.now || (() => new Date());
  const productResearchService = options.productResearchService || createProductResearchService(options);

  return {
    async revalidate(input = {}) {
      const previous = snapshot(input);
      assertSnapshot(previous);

      const result = await productResearchService.research({
        query: previous.productTitle || input.query || previous.productUrl,
        context: {
          ...input.context,
          country: input.context?.country || input.country,
          currency: input.context?.currency || previous.visiblePrice?.currency || input.currency,
          revalidation: {
            productUrl: previous.productUrl,
            evidence: previous.evidence,
            previous
          }
        }
      });
      const currentCandidate = matchingCandidate(result.candidates || [], previous.productUrl);
      const compared = currentCandidate ? comparisons(previous, currentCandidate) : {};
      const lastVerifiedAt = now().toISOString();

      return {
        model: 'CandidateRevalidation',
        modelVersion: 1,
        status: resultStatus(currentCandidate, compared),
        productUrl: previous.productUrl,
        lastVerifiedAt,
        previous,
        currentCandidate: currentCandidate || null,
        comparisons: compared,
        evidence: currentCandidate?.evidence || [],
        warnings: currentCandidate?.costCompleteness?.warnings || result.meta?.warnings || []
      };
    }
  };
}
