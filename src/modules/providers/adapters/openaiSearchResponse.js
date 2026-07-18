import { ServiceUnavailableError } from '../../../shared/errors.js';
import { OPENAI_WEB_PROVIDER_NAME } from './openaiSearchConfig.js';

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

export function parseOpenAiCandidatePayload(payload) {
  const text = extractOpenAiOutputText(payload);

  if (!text) {
    throw new ServiceUnavailableError('OpenAI web_search nao retornou JSON de candidatos.', {
      providerName: OPENAI_WEB_PROVIDER_NAME
    });
  }

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed.candidates) ? parsed : { candidates: [] };
  } catch {
    throw new ServiceUnavailableError('OpenAI web_search retornou JSON invalido.', {
      providerName: OPENAI_WEB_PROVIDER_NAME
    });
  }
}
