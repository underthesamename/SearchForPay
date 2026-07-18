export function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isIsoCurrency(value) {
  return typeof value === 'string' && /^[A-Z]{3}$/.test(value);
}

export function isHttpsUrl(value) {
  if (!hasText(value)) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function cleanText(value, maxLength = 260) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function sameCurrency(...values) {
  return new Set(values.map((value) => value?.currency)).size === 1;
}

export function validateMoney(errors, fieldName, value, { allowZero = true, expectedCurrency } = {}) {
  if (!isPlainObject(value)) {
    errors.push(`${fieldName} ausente.`);
    return;
  }

  if (!Number.isInteger(value.amountCents) || value.amountCents < 0) {
    errors.push(`${fieldName}.amountCents invalido.`);
  }

  if (!allowZero && value.amountCents === 0) {
    errors.push(`${fieldName}.amountCents precisa ser maior que zero.`);
  }

  if (!isIsoCurrency(value.currency)) {
    errors.push(`${fieldName}.currency invalida.`);
  } else if (isIsoCurrency(expectedCurrency) && value.currency !== expectedCurrency) {
    errors.push(`${fieldName}.currency diverge da moeda esperada.`);
  }
}
