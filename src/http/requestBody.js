import { ValidationError } from '../shared/errors.js';

export async function readJsonBody(request, options = {}) {
  const maxBytes = options.maxBytes || 16_384;
  const contentType = String(request.headers['content-type'] || '');
  let size = 0;
  let raw = '';

  if (options.requireJson !== false && !contentType.toLowerCase().includes('application/json')) {
    throw new ValidationError('Envie o corpo como application/json.');
  }

  for await (const chunk of request) {
    size += chunk.length;

    if (size > maxBytes) {
      throw new ValidationError('Corpo da requisicao excede o limite permitido.');
    }

    raw += chunk.toString('utf8');
  }

  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ValidationError('Corpo JSON invalido.');
  }
}
