const DEVELOPER_INSTRUCTIONS = [
  'Voce pesquisa ofertas reais de e-commerce usando web_search e retorna apenas JSON estruturado.',
  'Nunca invente loja, preco, frete, imposto, disponibilidade, moeda ou URL.',
  'Se imposto nao estiver claramente evidenciado, deixe taxes.amountCents como null e marque rejected=true.',
  'Se frete nao estiver exposto, use shipping.exposed=false, amountCents=null e warning claro.',
  'Resultado sem evidencia suficiente deve ser candidato rejeitado, nao oferta final.',
  'Use centavos inteiros na moeda solicitada e URLs HTTPS da propria oferta sempre que existirem.',
  'Nao retorne explicacoes fora do JSON.'
].join('\n');

export function createOpenAiWebInput(searchRequest, searchLimit) {
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
          task: 'Encontrar candidatos de ofertas reais para verificacao interna da SearchForPay.',
          product: searchRequest.query,
          maxCandidates: searchLimit,
          context: searchRequest.context,
          requiredForFinalOffer: [
            'price.amountCents com evidencia',
            'taxes.amountCents com evidencia',
            'sellerName',
            'productUrl HTTPS',
            'currency igual ao contexto'
          ],
          shippingRule: 'Frete ausente pode ficar como custo incompleto com warning; nao inventar valor.'
        })
      }]
    }
  ];
}
