import { decodeAlertCandidate } from './alertCandidatePayload.js';
import { searchParamsFromFormData } from './searchPayload.js';

function publicErrorMessage(error) {
  return error?.error?.message || 'Nao foi possivel revalidar este candidato agora.';
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw payload;
  return payload;
}

function buttonCandidate(button) {
  return button ? decodeAlertCandidate(button.dataset.revalidateCandidate) : null;
}

function revalidationMessage(result) {
  const checkedAt = result.lastVerifiedAt
    ? new Date(result.lastVerifiedAt).toLocaleString('pt-BR') : 'agora';
  return `Revalidacao: ${result.status} em ${checkedAt}.`;
}

function renderInlineStatus(button, result) {
  const card = button.closest('article');
  const body = card?.querySelector('.offer-body') || card;
  let line = card?.querySelector('[data-inline-revalidation]');

  if (!body) return;
  if (!line) {
    line = document.createElement('p');
    line.className = 'inline-revalidation';
    line.dataset.inlineRevalidation = 'true';
    body.append(line);
  }

  card.dataset.revalidationStatus = result.status;
  line.textContent = revalidationMessage(result);
}

function revalidationPayload(form, candidate) {
  const search = searchParamsFromFormData(new FormData(form));
  return {
    query: search.query || candidate.productTitle,
    context: {
      postalCode: search.postalCode,
      country: search.country,
      currency: search.currency
    },
    candidate
  };
}

export function setupCandidateActions({ form, isFilePage, setState }) {
  document.addEventListener('click', async (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-revalidate-candidate]') : null;
    const candidate = buttonCandidate(button);

    if (!candidate) return;
    if (isFilePage) {
      setState('error', 'Revalidacao exige servidor local', 'Abra a interface pelo servidor para consultar OpenAI Web Search.');
      return;
    }

    const previousText = button.textContent;
    button.disabled = true;
    button.textContent = 'Revalidando';
    setState('loading', 'Revalidando candidato', 'Consultando a fonte via OpenAI Web Search antes de atualizar a decisao.');

    try {
      const payload = await apiJson('/api/candidates/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(revalidationPayload(form, candidate))
      });
      renderInlineStatus(button, payload.revalidation);
      setState('success', 'Candidato revalidado', revalidationMessage(payload.revalidation));
    } catch (error) {
      setState('error', 'Revalidacao nao concluida', publicErrorMessage(error));
    } finally {
      button.disabled = false;
      button.textContent = previousText;
    }
  });
}
