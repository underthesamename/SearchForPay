import { ValidationError } from './errors.js';

export function normalizeSearchTerm(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateProductQuery(value) {
  const query = normalizeSearchTerm(value);

  if (query.length < 2) {
    throw new ValidationError('Informe um produto com pelo menos 2 caracteres.');
  }

  if (query.length > 120) {
    throw new ValidationError('A busca deve ter no maximo 120 caracteres.');
  }

  return query;
}

export function normalizeCurrencyCode(value) {
  const currency = String(value || '').trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new ValidationError('Informe uma moeda valida com 3 letras.');
  }

  return currency;
}

export function normalizePostalCode(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 20);
}

export function validatePublicId(value) {
  const id = String(value || '').trim();

  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) {
    throw new ValidationError('Identificador invalido.');
  }

  return id;
}
