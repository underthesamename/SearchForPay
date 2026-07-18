# SearchForPay - Produto

## Visao

SearchForPay e uma ferramenta de comparacao de ofertas reais de produtos na internet. O produto consulta fontes de compra confiaveis, normaliza as respostas, calcula o custo total de cada oferta e mostra ao usuario as 3 melhores opcoes encontradas.

A promessa central nao e "achar o menor preco de vitrine"; e encontrar a melhor oferta considerando produto, frete e imposto de forma transparente.

## Publico

- Pessoas que pesquisam produtos online antes de comprar.
- Usuarios que querem comparar lojas sem abrir muitas abas.
- Compradores que precisam entender o custo real antes de decidir.
- Futuramente, usuarios avancados que querem acompanhar variacao de preco ou disponibilidade.

## Problema

Comparadores comuns podem destacar um preco inicial baixo e esconder custos que mudam a decisao final, como frete, imposto, disponibilidade ou erro de loja. A SearchForPay existe para reduzir esse ruido: uma oferta so deve aparecer quando o sistema consegue confirmar os componentes essenciais do custo total em uma fonte real.

## Fluxo Principal Do Usuario

1. O usuario informa o produto que deseja buscar.
2. Quando necessario para calcular frete ou imposto, o usuario informa contexto de compra, como CEP, pais e moeda.
3. A API consulta apenas provedores reais configurados no ambiente.
4. Cada provedor retorna ofertas normalizadas no contrato do projeto.
5. O sistema valida cada oferta recebida.
6. Ofertas invalidas sao descartadas e contabilizadas em metadados.
7. O sistema calcula o custo total de cada oferta valida.
8. As ofertas validas sao ordenadas pelo menor custo total.
9. A interface apresenta ate 3 melhores opcoes, com separacao entre preco do produto, frete, imposto e custo total.
10. Se nao houver provedor real configurado, ou se nenhum provedor retornar oferta valida, a API falha de forma clara.

## Oferta Valida

Uma oferta valida e uma resposta vinda de um provedor real configurado que atende, no minimo, aos criterios abaixo.

Campos obrigatorios:

- `providerName`: nome do provedor real configurado.
- `source.type`: tipo de fonte real, como `api`, `feed`, `affiliate` ou `partner`.
- `source.name`: nome da fonte real de onde a oferta veio.
- `productTitle`: nome real do produto retornado pela fonte.
- `productUrl`: URL HTTPS real e acessivel da pagina de compra ou detalhe do produto.
- `seller.name`: nome real da loja ou vendedor.
- `price.amountCents`: preco do produto em centavos.
- `price.currency`: moeda do preco, com codigo de 3 letras.
- `shipping.amountCents`: frete calculado ou confirmado em centavos.
- `shipping.currency`: mesma moeda do preco.
- `taxes.amountCents`: impostos calculados ou confirmados em centavos.
- `taxes.currency`: mesma moeda do preco.

Regras de validade:

- A oferta precisa vir de API, feed, integracao parceira ou fonte real permitida.
- `providerName` precisa bater com o provedor real configurado que retornou a oferta.
- Valores monetarios precisam ser inteiros em centavos e maiores ou iguais a zero.
- `price.amountCents` precisa ser maior que zero.
- Preco, frete e imposto precisam usar a mesma moeda.
- Frete desconhecido nao pode ser tratado como zero.
- Imposto desconhecido nao pode ser tratado como zero.
- Loja, produto, URL, preco, frete ou imposto nao podem ser inventados.
- Erros de provedor nao podem expor token, chave, credencial ou dado pessoal.
- Se um provedor nao conseguir calcular frete ou imposto com base real, a oferta deve ser descartada ou marcada como erro pelo adaptador.

Campos recomendados para melhorar confianca e ordenacao futura:

- `seller.reputationScore`: reputacao quando a fonte fornecer esse dado.
- `delivery.minDays` e `delivery.maxDays`: prazo estimado quando calculado pela fonte.
- `availability`: disponibilidade real quando fornecida pelo provedor.
- `capturedAt`: horario em que a oferta foi capturada.

## Fontes Reais

Fontes reais sao integracoes capazes de retornar dados verificaveis de compra. Para o MVP, uma fonte so deve ser aceita quando houver adaptador real registrado em `src/modules/providers/` e ativacao explicita por configuracao.

Fontes aceitas:

- APIs oficiais de marketplaces ou lojas.
- Feeds comerciais, afiliados ou parceiros com permissao de uso.
- Integracoes que retornem preco, frete e imposto de forma rastreavel.

Fontes nao aceitas:

- Dados inseridos manualmente para simular resultado.
- Lojas falsas.
- Precos estimados sem origem real.
- Frete ou imposto preenchido por chute.
- Mock de desenvolvimento exibido ao usuario final.
- Scraping fragil ou nao permitido pelos termos da fonte.

## Calculo De Custo Total

O custo total e a base do ranking:

```text
custo_total = preco_do_produto + frete + imposto
```

No contrato atual, o calculo usa:

- `price.amountCents`
- `shipping.amountCents`
- `taxes.amountCents`

O resultado deve preservar a moeda da oferta e expor o detalhamento:

- produto
- frete
- imposto
- total

Uma oferta com preco menor pode perder posicao se o frete ou imposto tornar o custo total maior.

## Alertas De Preco

O alerta de preco salva a busca do usuario, o contexto de entrega e um custo total alvo na mesma moeda da busca. O criterio de disparo e objetivo: a melhor oferta valida de uma reconsulta real precisa ter `totalCost.amountCents` menor ou igual ao alvo salvo.

O alerta nao cria historico artificial, nao estima queda e nao preenche preco ausente. Cada verificacao chama os provedores reais configurados pelo motor de busca, passa pelas mesmas validacoes de oferta valida e registra apenas o status publico da ultima revalidacao.

## Limites Do MVP

O MVP deve provar que a SearchForPay consegue buscar ofertas reais, validar dados essenciais e ranquear por custo total.

Incluido no MVP:

- Busca por texto.
- Contexto minimo para frete e imposto, como CEP quando aplicavel.
- Moeda do contexto da busca para evitar comparar ofertas em moedas diferentes.
- Registro de provedores reais por configuracao.
- Contrato unico de oferta normalizada.
- Validacao contra ofertas incompletas.
- Ranking das 3 melhores ofertas por custo total.
- Erro claro quando nao houver provedor real configurado.
- Interface simples para executar busca e visualizar resultados.

Fora do MVP:

- Checkout dentro da SearchForPay.
- Conta de usuario.
- Historico longitudinal de preco.
- Notificacao externa por email, push ou WhatsApp.
- Recomendacao personalizada por perfil.
- Estoque garantido apos o momento da consulta.
- Cobertura de todos os marketplaces.
- Comparacao baseada em cashback, cupom privado ou pontos, a menos que a fonte real retorne esses dados de forma confiavel.
- Qualquer resultado ficticio para "preencher a tela".
