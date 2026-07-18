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
import { setupCandidateActions } from './candidateActions.js';
import { setupSearchMemory } from './historyUi.js';
import { apiSearchParams, searchParamsFromFormData } from './searchPayload.js';

const form = document.querySelector('[data-search-form]');
const isFilePage = window.location.protocol === 'file:';
let searchMemory;

async function checkHealth() {
  if (isFilePage) {
    setHealth(null);
    setState('error', 'Abra pelo servidor local', 'Use http://127.0.0.1:3000/ para carregar a API real.');
    return;
  }

  try {
    const response = await fetch('/health');
    const payload = await response.json();
    setHealth({
      mode: payload.searchMode,
      openAiEnabled: payload.openaiWebSearch?.enabled === true,
      enabledLegacyProviders: payload.enabledProviders?.length || 0
    });
  } catch {
    setHealth(null);
  }
}

async function runSearch(search) {
  if (isFilePage) {
    clearResults();
    setState('error', 'Busca exige servidor local', 'Abra http://127.0.0.1:3000/ para consultar a pesquisa web.');
    return;
  }

  clearResults();
  setLoading(true);
  renderLoading();
  setState('loading', 'Pesquisando na web', 'Aguarde a verificacao das evidencias encontradas.');
  searchMemory.remember(search);

  try {
    const params = apiSearchParams(search);
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
  await runSearch(searchParamsFromFormData(new FormData(form)));
});

searchMemory = setupSearchMemory({ form, onSearch: runSearch });
setupPriceAlerts({ searchForm: form, isFilePage, setState });
setupCandidateActions({ form, isFilePage, setState });
checkHealth();
