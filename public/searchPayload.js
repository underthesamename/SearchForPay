function fieldValue(formData, name) {
  return String(formData.get(name) || '').trim();
}

export function searchParamsFromFormData(formData) {
  return {
    query: fieldValue(formData, 'query'),
    postalCode: fieldValue(formData, 'postalCode'),
    country: fieldValue(formData, 'country').toUpperCase(),
    currency: fieldValue(formData, 'currency').toUpperCase(),
    comparisonCriteria: fieldValue(formData, 'comparisonCriteria') || 'custo_total_confirmado'
  };
}

export function apiSearchParams(search) {
  return new URLSearchParams({
    query: String(search.query || ''),
    postalCode: String(search.postalCode || ''),
    country: String(search.country || ''),
    currency: String(search.currency || '')
  });
}
