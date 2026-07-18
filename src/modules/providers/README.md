# Provedores Legados

O caminho principal da SearchForPay e `searchMode=web_research`. Ele usa OpenAI Web Search, gera `WebOfferCandidate`, promove somente custo completo para `VerifiedOffer` e retorna `SearchResult` com `SearchEvidence` e `CostCompleteness`.

Esta pasta ainda guarda adaptadores historicos de loja, marketplace, afiliado ou feed comercial. Eles ficam fora do produto principal e nao devem ser habilitados para preencher resultado quando OpenAI Web Search estiver desativada ou sem chave.

## Uso Permitido

- Manter compatibilidade tecnica em `searchMode=legacy_providers`.
- Rodar testes antigos de contrato sem chamar o caminho principal.
- Consultar codigo legado durante migracao ou remocao planejada.

## Uso Proibido No Produto Principal

- Usar `MARKETPLACE_PROVIDERS` como requisito para busca comum.
- Usar API de loja, marketplace, afiliado ou feed comercial como fallback.
- Promover candidato incompleto para oferta completa.
- Tratar frete desconhecido ou imposto desconhecido como zero.
- Criar dado ficticio para evitar tela vazia.

## Regra De Erro

No modo principal, ausencia de OpenAI configurada deve gerar erro claro. O sistema nao deve tentar compensar usando adaptador legado nem dado simulado.

## Migracao

Novas regras de produto devem viver em `src/modules/search/` e `src/modules/ai-search/`. Esta pasta deve encolher com o tempo ate que os adaptadores legados possam ser removidos com seguranca.
