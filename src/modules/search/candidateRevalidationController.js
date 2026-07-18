import { ServiceUnavailableError } from '../../shared/errors.js';
import { readJsonBody } from '../../http/requestBody.js';
import { sendJson } from '../../http/responses.js';

function contextFromInput(input) {
  return input.context || {
    postalCode: input.postalCode,
    country: input.country,
    currency: input.currency
  };
}

export async function handleCandidateRevalidationRequest({
  request,
  response,
  candidateRevalidationService,
  bodyLimitBytes
}) {
  if (!candidateRevalidationService) {
    throw new ServiceUnavailableError('Revalidacao OpenAI Web Search nao esta configurada.');
  }

  const input = await readJsonBody(request, { maxBytes: bodyLimitBytes });
  const revalidation = await candidateRevalidationService.revalidate({
    candidate: input.candidate || input.candidateTarget,
    query: input.query,
    context: contextFromInput(input)
  });

  return sendJson(response, 200, { revalidation });
}
