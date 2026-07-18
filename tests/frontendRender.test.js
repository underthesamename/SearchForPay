import test from 'node:test';
import assert from 'node:assert/strict';

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.hidden = false;
    this._text = '';
  }
  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }
  get textContent() {
    return [this._text, ...this.children.map((child) => child.textContent)].join('');
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this._text = '';
    this.children = [...nodes];
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  focus() {}
}

function fakeDocument() {
  const nodes = {};
  return {
    nodes,
    body: new FakeNode('body'),
    createElement: (tagName) => new FakeNode(tagName),
    querySelector(selector) {
      nodes[selector] ||= new FakeNode('div');
      return nodes[selector];
    }
  };
}

async function loadView() {
  const document = fakeDocument();
  globalThis.document = document;
  const view = await import(`../public/view.js?render=${Date.now()}-${Math.random()}`);
  return { view, nodes: document.nodes };
}

function offer() {
  return {
    providerName: 'marketplace-real',
    source: { name: 'Fonte API real' },
    productTitle: 'Notebook validado',
    productUrl: 'https://example.com/notebook-api',
    seller: { name: 'Loja API' },
    totalCost: {
      amountCents: 111500,
      currency: 'BRL',
      complete: true,
      breakdown: {
        product: { amountCents: 100000, currency: 'BRL' },
        shipping: { amountCents: 10000, currency: 'BRL' },
        taxes: { amountCents: 1500, currency: 'BRL' }
      }
    },
    evidence: [{
      url: 'https://example.com/notebook-api',
      title: 'Fonte da oferta',
      snippet: 'Preco, frete e imposto confirmados.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    verification: {
      confidenceLevel: 'high',
      evidence: [{
        url: 'https://example.com/notebook-api',
        title: 'Fonte da oferta',
        snippet: 'Preco, frete e imposto confirmados.',
        accessedAt: '2026-07-18T12:00:00.000Z'
      }]
    },
    lastVerifiedAt: '2026-07-18T12:05:00.000Z',
    ranking: { explanation: 'Entrou pelo custo total.', criteria: { delivery: 'ate 5 dias' } }
  };
}

function candidate() {
  return {
    productTitle: 'Notebook achado na web',
    storeName: 'Loja citada pela pagina',
    productUrl: 'https://example.com/notebook-web',
    visiblePrice: { amountCents: 90000, currency: 'BRL' },
    shipping: { exposed: false, amountCents: null, currency: null, warning: 'Frete nao exposto.' },
    taxes: { exposed: false, amountCents: null, currency: null, warning: 'Imposto nao exposto.' },
    evidence: [{
      url: 'https://example.com/notebook-web',
      title: 'Pagina consultada',
      snippet: 'Trecho curto de evidencia.',
      accessedAt: '2026-07-18T12:00:00.000Z'
    }],
    confidence: 'medium',
    warnings: ['Confirmar no site antes de comprar.'],
    researchStatus: {
      warnings: ['Frete nao exposto; candidato tem custo total incompleto.']
    },
    ranking: {
      position: 2,
      group: 'custo_incompleto',
      explanation: 'Posicao 2: custo incompleto (shipping, taxes); preco visivel nao e custo total.'
    }
  };
}

function anchors(node) {
  return [
    ...(node.tagName === 'a' ? [node] : []),
    ...node.children.flatMap(anchors)
  ];
}

function buttons(node) {
  return [
    ...(node.tagName === 'button' ? [node] : []),
    ...node.children.flatMap(buttons)
  ];
}

test('frontend renderiza ofertas completas verificadas na web', async () => {
  const { view, nodes } = await loadView();
  view.renderResults({
    results: [{ ...offer(), searchMode: 'web_research' }],
    webCandidates: [],
    meta: { providerReports: [] }
  });

  assert.match(nodes['[data-results]'].textContent, /Oferta completa verificada na web/);
  assert.match(nodes['[data-results]'].textContent, /custo total/);
  assert.match(nodes['[data-results]'].textContent, /Revalidar/);
  assert.match(nodes['[data-results]'].textContent, /Criar alerta/);
  assert.equal(nodes['[data-state-title]'].textContent, 'Ofertas completas');
  assert.equal(nodes['[data-web-candidates]'].textContent, '');
});

test('frontend renderiza candidatos incompletos com avisos e evidencias clicaveis', async () => {
  const { view, nodes } = await loadView();
  view.renderResults({ results: [], webCandidates: [candidate()], meta: { providerReports: [] } });
  const text = nodes['[data-web-candidates]'].textContent;

  assert.match(text, /Candidato encontrado na web/);
  assert.match(text, /Candidatos com custo incompleto/);
  assert.match(text, /Frete nao exposto/);
  assert.match(text, /Imposto nao exposto/);
  assert.match(text, /preco visivel nao e custo total/);
  assert.match(text, /Precisa confirmacao no site da loja/);
  assert.match(text, /Subtotal conhecido/);
  assert.match(text, /Ultima verificacao: pendente/);
  assert.equal(buttons(nodes['[data-web-candidates]']).some((button) => button.dataset.revalidateCandidate), true);
  assert.equal(anchors(nodes['[data-web-candidates]']).some((link) => link.href === 'https://example.com/notebook-web'), true);
  assert.doesNotMatch(text, /melhor preco|melhor preço/i);
});

test('frontend renderiza estado sem resultados', async () => {
  const { view, nodes } = await loadView();
  view.renderResults({ results: [], webCandidates: [], meta: { providerReports: [] } });

  assert.equal(nodes['[data-state-title]'].textContent, 'Sem candidatos verificaveis');
  assert.equal(nodes['[data-result-count]'].textContent, '');
  assert.equal(nodes['[data-main]'].hidden, false);
});

test('frontend renderiza erro de OpenAI com relatorio', async () => {
  const { view, nodes } = await loadView();
  view.renderSearchError({
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'OpenAI Web Search nao esta disponivel.',
      details: {
        webResearch: {
          status: 'disabled',
          providerName: 'openaiweb',
          message: 'OpenAI Search desativada.'
        }
      }
    }
  });

  assert.equal(nodes['[data-state-title]'].textContent, 'Busca nao concluida');
  assert.match(nodes['[data-state-message]'].textContent, /ambiente do servidor/);
  assert.doesNotMatch(nodes['[data-state-message]'].textContent, /OPENAI_API_KEY/);
  assert.match(nodes['[data-provider-report]'].textContent, /openaiweb/);
});

test('frontend diferencia rate limit de falta de configuracao OpenAI', async () => {
  const { view, nodes } = await loadView();
  view.renderSearchError({
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'OpenAI Web Search nao esta disponivel.',
      details: {
        webResearch: {
          status: 'failed',
          providerName: 'openaiweb',
          message: 'OpenAI Responses API atingiu limite de uso temporario.'
        }
      }
    }
  });

  const text = nodes['[data-state-message]'].textContent;

  assert.match(text, /limite de uso temporario/);
  assert.match(text, /Aguarde alguns minutos/);
  assert.doesNotMatch(text, /configure a chave OpenAI/);
});
