const SECRET_FIELD_PATTERN = /(api[_-]?key|authorization|bearer|token|secret|password|credential)/i;
const POSTAL_FIELD_PATTERN = /^(postalCode|postal_code|cep|zip|zipCode)$/i;

const TEXT_REDACTIONS = Object.freeze([
  [/\bOPENAI_API_KEY\b/g, '[redacted-config]'],
  [/\bsk-[A-Za-z0-9][A-Za-z0-9_-]{8,}\b/g, '[redacted-openai-key]'],
  [/\bopenai-key-[A-Za-z0-9_-]+\b/gi, '[redacted-openai-key]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]'],
  [/\bBasic\s+[A-Za-z0-9+/=-]+/gi, 'Basic [redacted]']
]);

export function redactSensitiveText(value) {
  return TEXT_REDACTIONS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value)
  );
}

export function maskPostalCode(value) {
  const normalized = String(value || '').replace(/\s+/g, '');
  return normalized.length > 3 ? `CEP final ${normalized.slice(-3)}` : 'CEP salvo';
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function sanitizePublicPayload(value, seen = new WeakSet()) {
  if (typeof value === 'string') {
    return redactSensitiveText(value);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (seen.has(value)) {
    return '[Circular]';
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const sanitized = value.map((item) => sanitizePublicPayload(item, seen));
    seen.delete(value);
    return sanitized;
  }

  if (!isPlainObject(value)) {
    seen.delete(value);
    return redactSensitiveText(String(value));
  }

  const sanitized = Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (SECRET_FIELD_PATTERN.test(key)) {
      return [key, '[redacted]'];
    }

    if (POSTAL_FIELD_PATTERN.test(key)) {
      return [key, maskPostalCode(entry)];
    }

    return [key, sanitizePublicPayload(entry, seen)];
  }));
  seen.delete(value);
  return sanitized;
}
