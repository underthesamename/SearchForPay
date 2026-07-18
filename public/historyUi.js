import { el } from './dom.js';
import { createSearchMemory, maskPostalCode } from './historyStore.js';

const memory = createSearchMemory();
const historyList = document.querySelector('[data-history-list]');
const preferencesList = document.querySelector('[data-preferences]');
const applyPreferencesButton = document.querySelector('[data-apply-preferences]');
const clearHistoryButton = document.querySelector('[data-clear-history]');

function formField(form, name) {
  return form.elements.namedItem(name);
}

function applySearchToForm(form, search, shouldFocusQuery = false) {
  for (const fieldName of ['query', 'postalCode', 'country', 'currency']) {
    const field = formField(form, fieldName);

    if (field && search[fieldName]) {
      field.value = search[fieldName];
    }
  }

  if (shouldFocusQuery) {
    formField(form, 'query')?.focus();
  }
}

function renderPreferences(preferences) {
  preferencesList.replaceChildren();
  applyPreferencesButton.disabled = !preferences;

  if (!preferences) {
    preferencesList.append(el('p', 'memory-empty', 'Nada salvo neste navegador.'));
    return;
  }

  for (const [label, value] of [
    ['CEP', maskPostalCode(preferences.postalCode)],
    ['Pais', preferences.country],
    ['Moeda', preferences.currency]
  ]) {
    const row = el('div', 'preference-row');
    row.append(el('dt', '', label), el('dd', '', value));
    preferencesList.append(row);
  }
}

function renderHistory(history) {
  historyList.replaceChildren();
  clearHistoryButton.disabled = history.length === 0;

  if (history.length === 0) {
    historyList.append(el('p', 'memory-empty', 'Nenhuma busca salva.'));
    return;
  }

  history.forEach((search, index) => {
    const item = el('button', 'history-item');
    item.type = 'button';
    item.dataset.historyIndex = String(index);
    item.append(el('strong', '', search.query));
    item.append(el('span', '', `${maskPostalCode(search.postalCode)} / ${search.country} / ${search.currency}`));
    historyList.append(item);
  });
}

function renderMemory() {
  renderPreferences(memory.loadPreferences());
  renderHistory(memory.loadHistory());
}

export function setupSearchMemory({ form, onSearch }) {
  const preferences = memory.loadPreferences();

  if (preferences) {
    applySearchToForm(form, preferences);
  }

  historyList.addEventListener('click', async (event) => {
    const target = event.target instanceof Element ? event.target : event.target.parentElement;
    const item = target?.closest('[data-history-index]');
    const search = memory.loadHistory()[Number(item?.dataset.historyIndex)];

    if (search) {
      applySearchToForm(form, search);
      await onSearch(search);
    }
  });

  applyPreferencesButton.addEventListener('click', () => {
    const savedPreferences = memory.loadPreferences();

    if (savedPreferences) {
      applySearchToForm(form, savedPreferences, true);
    }
  });

  clearHistoryButton.addEventListener('click', () => {
    memory.clearHistory();
    renderMemory();
  });

  renderMemory();

  return {
    remember(search) {
      memory.saveSearch(search);
      renderMemory();
    }
  };
}
