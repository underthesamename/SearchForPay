import { ServiceUnavailableError } from '../../shared/errors.js';

const DEFAULT_PROVIDER_NAME = 'openaiweb';

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function textFromContent(content) {
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => item?.text || item?.output_text || '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function extractOpenAiOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload?.output)) {
    return '';
  }

  return payload.output
    .filter((item) => item?.type === 'message')
    .map((item) => textFromContent(item.content))
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function parseOpenAiCandidatePayload(payload, options = {}) {
  const providerName = options.providerName || DEFAULT_PROVIDER_NAME;
  const text = extractOpenAiOutputText(payload);

  if (!text) {
    throw new ServiceUnavailableError('OpenAI web_search nao retornou JSON de candidatos.', {
      providerName
    });
  }

  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ServiceUnavailableError('OpenAI web_search retornou JSON invalido.', {
      providerName
    });
  }

  if (!isPlainObject(parsed) || !isPlainObject(parsed.research) || !Array.isArray(parsed.candidates)) {
    throw new ServiceUnavailableError('OpenAI web_search retornou JSON fora do contrato.', {
      providerName
    });
  }

  return parsed;
}
