const DEVELOPER_INSTRUCTIONS = [
  'Voce executa pesquisa profunda de ofertas reais usando web_search como motor principal.',
  'Nao use APIs de lojas, marketplaces, afiliados, feeds comerciais ou dados simulados.',
  'Pesquise multiplas fontes HTTPS reais antes de retornar candidatos.',
  'Nunca invente loja, preco, frete, imposto, disponibilidade, moeda ou URL.',
  'WebOfferCandidate nao e oferta final: ele ainda sera validado e pode ficar fora do ranking.',
  'So retorne candidato se houver preco visivel e evidencia HTTPS clicavel.',
  'Rejeite candidatos sem preco visivel, sem URL HTTPS do produto ou sem evidencia HTTPS.',
  'Se imposto nao estiver exposto, use taxes.exposed=false, taxes.amountCents=null e warning claro.',
  'Se frete nao estiver exposto, use shipping.exposed=false, shipping.amountCents=null e warning claro.',
  'Nunca trate imposto desconhecido ou frete desconhecido como zero.',
  'Retorne warnings objetivos sobre custo incompleto, disponibilidade, entrega, imposto ou evidencia limitada.',
  'Cada candidato precisa ter evidence com URL HTTPS, titulo, trecho curto e data accessedAt.',
  'Use centavos inteiros na moeda solicitada e URLs HTTPS da propria oferta ou fonte consultada.',
  'Preencha research com consultas feitas, fontes HTTPS consultadas, avisos e horario da resposta.',
  'Se context.revalidation existir, revalide exatamente aquele productUrl/evidencia e nao substitua por outro produto.',
  'Nao retorne explicacoes fora do JSON.'
].join('\n');

function sourceTarget(maxCandidates) {
  return Math.min(Math.max(maxCandidates, 2), 5);
}

function taskFor(searchRequest) {
  return searchRequest.context?.revalidation
    ? 'Revalidar candidato web existente usando productUrl e evidencias anteriores.'
    : 'Encontrar candidatos de ofertas reais para verificacao interna da SearchForPay.';
}

export function createOpenAiWebInput(searchRequest, maxCandidates) {
  return [
    {
      role: 'developer',
      content: [{ type: 'input_text', text: DEVELOPER_INSTRUCTIONS }]
    },
    {
      role: 'user',
      content: [{
        type: 'input_text',
        text: JSON.stringify({
          task: taskFor(searchRequest),
          searchMode: 'web_research',
          product: searchRequest.query,
          maxCandidates,
          sourceTarget: sourceTarget(maxCandidates),
          context: searchRequest.context,
          reproducibility: [
            'Liste em research.searchedQueries as consultas principais usadas.',
            'Liste em research.sourcesSearched as fontes HTTPS consultadas.',
            'Use accessedAt em ISO 8601 para cada evidencia.',
            'Nao retorne fonte sem URL HTTPS.'
          ],
          candidateContract: [
            'productTitle',
            'storeName',
            'productUrl HTTPS',
            'visiblePrice.amountCents e visiblePrice.currency',
            'shipping.exposed, amountCents/currency quando exposto ou warning quando ausente',
            'taxes.exposed, amountCents/currency quando confirmado ou warning quando ausente',
            'evidence[] com url HTTPS, title, snippet e accessedAt',
            'confidence high, medium ou low',
            'availability quando visivel, senao unknown',
            'warnings[] com custo incompleto ou limites de verificacao'
          ],
          rejectionRules: [
            'Nao inclua candidato sem preco visivel.',
            'Nao inclua candidato sem evidencia HTTPS.',
            'Nao inclua candidato se a pagina indicar indisponibilidade sem preco compravel.',
            'Na revalidacao, nao inclua candidato que nao corresponda ao productUrl anterior.',
            'Nao converta frete ou imposto desconhecido em zero.'
          ],
          promotionRules: [
            'So pode virar oferta final se imposto real estiver confirmado.',
            'Frete desconhecido nao e zero; fica como custo incompleto com warning.',
            'Moeda precisa ser igual ao contexto antes de qualquer ranking.'
          ]
        })
      }]
    }
  ];
}
