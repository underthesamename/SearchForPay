import { sendJson } from '../../http/responses.js';
import { ValidationError } from '../../shared/errors.js';
import { createSearchRequest } from './searchModels.js';

function singleSearchParam(url, name) {
  const values = url.searchParams.getAll(name);

  if (values.length > 1) {
    throw new ValidationError(`Parametro duplicado: ${name}.`);
  }

  return values[0] || null;
}

export async function createSearchPayload({
  url,
  searchService,
  defaultCountry,
  defaultCurrency,
  defaultSearchMode = 'web_research'
}) {
  const searchRequest = createSearchRequest({
    query: singleSearchParam(url, 'query'),
    searchMode: singleSearchParam(url, 'searchMode') || defaultSearchMode,
    context: {
      postalCode: singleSearchParam(url, 'postalCode'),
      country: singleSearchParam(url, 'country') || defaultCountry,
      currency: singleSearchParam(url, 'currency') || defaultCurrency
    }
  });
  return searchService.search(searchRequest);
}

export async function handleSearchRequest({
  url,
  response,
  searchService,
  defaultCountry,
  defaultCurrency,
  defaultSearchMode
}) {
  const payload = await createSearchPayload({
    url,
    searchService,
    defaultCountry,
    defaultCurrency,
    defaultSearchMode
  });

  return sendJson(response, 200, payload);
}
