# SearchForPay - Produto

## Visao

SearchForPay e uma ferramenta completa de pesquisa e verificacao de ofertas na web. O motor principal e OpenAI Web Search pela Responses API, usado para localizar paginas reais, extrair candidatos, registrar evidencias clicaveis e ajudar o usuario a confirmar a compra no site original da loja.

A promessa central nao e precisao absoluta nem menor preco garantido. A promessa e reduzir ruido: separar candidato, evidencia, custo completo, custo incompleto e necessidade de confirmacao antes de chamar algo de oferta final.

## Principios

- Nao usar APIs de lojas, marketplaces, afiliados ou feeds comerciais.
- Nao inventar loja, preco, frete, imposto, disponibilidade ou URL.
- Nao chamar candidato incompleto de oferta final.
- Frete desconhecido nao vira zero.
- Imposto desconhecido nao vira zero.
- Toda informacao precisa ter evidencia clicavel quando possivel.
- Paginas mudam; a SearchForPay mostra evidencias, data de captura, avisos e caminho de confirmacao.

## Publico

- Pessoas que pesquisam produtos online antes de comprar.
- Usuarios que querem comparar achados da web sem abrir muitas abas.
- Compradores que precisam enxergar preco, frete, imposto, disponibilidade e confianca antes de decidir.
- Usuarios avancados que querem historico, alertas e revalidacao de oportunidades.

## Estados Do Produto

`candidato encontrado`: resultado bruto localizado pela busca web. Tem produto, URL ou trecho promissor, mas ainda nao possui dados suficientes para comparacao.

`candidato verificavel`: possui URL HTTPS clicavel, loja identificavel e evidencia legivel para pelo menos produto e preco. Ainda pode faltar frete, imposto, disponibilidade ou confirmacao.

`oferta completa`: candidato verificavel com produto, loja, URL HTTPS, preco, frete, imposto, moeda, disponibilidade e evidencias suficientes para compor custo total. Pode entrar no ranking principal, sempre com aviso de que a loja deve ser conferida antes da compra.

`custo incompleto`: candidato com preco real visivel, mas frete ou imposto ausente, desconhecido, dinamico ou dependente de checkout. Aparece separado do ranking de ofertas completas.

`precisa confirmacao`: candidato cuja evidencia nao resolve algum ponto decisivo, como preco dinamico, cupom, variacao, estoque, regiao, frete ou imposto. A interface deve levar o usuario ao site da loja.

`indisponivel`: pagina ou evidencia indica produto fora de estoque, link quebrado, compra indisponivel, preco removido ou informacao conflitante que impede comparacao honesta.

## Fluxo Completo

1. Busca: o usuario informa produto, pais, moeda e contexto de entrega quando necessario.
2. Pesquisa web: OpenAI Web Search localiza paginas de produto, comparativos publicos e fontes com evidencias.
3. Evidencias: cada candidato recebe links, titulos, trechos, horario de captura e campo evidenciado.
4. Normalizacao: o sistema extrai campos estruturados sem completar lacunas por chute.
5. Classificacao de estado: cada item vira candidato encontrado, candidato verificavel, oferta completa, custo incompleto, precisa confirmacao ou indisponivel.
6. Ranking: somente ofertas completas sao ordenadas por custo total. Candidatos incompletos ficam em secoes proprias.
7. Historico: cada busca salva consulta, filtros, estados, evidencias, avisos e data de captura para comparacao futura.
8. Alertas: o usuario define alvo de custo total. O alerta so dispara como oferta quando uma revalidacao encontra oferta completa dentro do alvo.
9. Revalidacao: buscas salvas e alertas sao pesquisados novamente, com nova evidencia e novo estado.
10. Confirmacao no site da loja: antes da compra, o usuario abre a evidencia principal para confirmar preco, frete, imposto, estoque e condicoes finais.

## Evidencias

Uma evidencia valida deve registrar, quando possivel:

- URL HTTPS clicavel.
- Titulo da pagina ou fonte.
- Trecho curto que justifica o campo extraido.
- Campo sustentado pela evidencia: produto, preco, frete, imposto, disponibilidade ou loja.
- `capturedAt` ou `accessedAt`.

Se um campo importante nao tiver evidencia, ele deve aparecer como ausente, desconhecido ou pendente. O produto pode continuar util como candidato, mas nao como oferta completa.

## Ranking

O ranking principal usa apenas `oferta completa`.

```text
custo_total = preco_do_produto + frete + imposto
```

Regras:

- Preco, frete e imposto precisam usar a mesma moeda.
- Frete e imposto precisam ser valores reais evidenciados ou claramente calculados a partir da pagina da loja.
- Itens com custo incompleto nao disputam posicao com ofertas completas.
- Em empate, o sistema pode usar disponibilidade, qualidade da evidencia, recencia e confianca da pagina.
- Resultado patrocinado, afiliado ou comercial nao deve alterar ranking sem rotulo explicito; no posicionamento atual, a SearchForPay nao usa feeds afiliados.

## Historico

O historico guarda a trilha da pesquisa, nao uma verdade permanente. Cada registro deve conter consulta, contexto publico da busca, estado dos candidatos, evidencias, avisos, custo total quando completo e data de captura. Dados sensiveis, como CEP completo, nao devem aparecer em logs ou respostas publicas sem mascara.

## Alertas E Revalidacao

Alertas usam a mesma regra da busca: reconsultar a web, capturar novas evidencias, reclassificar estados e comparar apenas ofertas completas contra o alvo. Quando a melhor oportunidade estiver em `custo incompleto` ou `precisa confirmacao`, o alerta pode avisar que ha candidato promissor, mas nao pode anunciar uma oferta final.

## Limites Declarados

- A SearchForPay nao faz checkout.
- A SearchForPay nao garante estoque depois da captura.
- A SearchForPay nao garante cobertura de todas as lojas.
- A SearchForPay nao substitui a confirmacao no site da loja.
- Sem OpenAI Web Search configurado, o produto deve falhar de forma clara em vez de preencher a tela com dados falsos.
