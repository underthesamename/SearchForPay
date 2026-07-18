import {
  clearResults,
  renderLoading,
  renderResults,
  renderSearchError,
  setHealth,
  setLoading,
  setState
} from './view.js';
import { setupPriceAlerts } from './alertsUi.js';
import { setupSearchMemory } from './historyUi.js';

const form = document.querySelector('[data-search-form]');
const isFilePage = window.location.protocol === 'file:';
let searchMemory;

async function checkHealth() {
  if (isFilePage) {
    setHealth(null);
    setState('error', 'Abra pelo servidor local', 'Use http://127.0.0.1:3001/ para carregar a API real.');
    return;
  }

  try {
    const response = await fetch('/health');
    const payload = await response.json();
    setHealth(payload.enabledProviders?.length || 0);
  } catch {
    setHealth(null);
  }
}

function searchParamsFromForm(formData) {
  return {
    query: String(formData.get('query') || '').trim(),
    postalCode: String(formData.get('postalCode') || '').trim(),
    country: String(formData.get('country') || '').trim().toUpperCase(),
    currency: String(formData.get('currency') || '').trim().toUpperCase()
  };
}

async function runSearch(search) {
  if (isFilePage) {
    clearResults();
    setState('error', 'Busca exige servidor local', 'Abra http://127.0.0.1:3001/ para consultar provedores reais.');
    return;
  }

  clearResults();
  setLoading(true);
  renderLoading();
  setState('loading', 'Consultando provedores reais', 'Aguarde a resposta das fontes configuradas.');
  searchMemory.remember(search);

  try {
    const params = new URLSearchParams(search);
    const response = await fetch(`/api/search?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      renderSearchError(payload);
      return;
    }

    renderResults(payload);
  } catch {
    clearResults();
    setState('error', 'Falha de conexao', 'A API local nao respondeu.');
  } finally {
    setLoading(false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await runSearch(searchParamsFromForm(new FormData(form)));
});

searchMemory = setupSearchMemory({ form, onSearch: runSearch });
setupPriceAlerts({ searchForm: form, isFilePage });
checkHealth();
