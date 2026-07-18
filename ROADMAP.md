# SearchForPay - Roadmap

## Fase 1: Reposicionamento Do Produto
Objetivo: tornar a SearchForPay um produto completo de pesquisa e verificacao de ofertas na web, sem APIs de lojas, marketplaces, afiliados ou feeds comerciais.

Entregaveis:
- `PRODUCT.md` com visao, estados, fluxo completo, evidencias, ranking, historico, alertas e revalidacao.
- `README.md` com uso atual centrado em OpenAI Web Search.
- Remocao da promessa de ranking por APIs de lojas.

Criterio de pronto:
- Nenhum documento chama candidato incompleto de oferta final.
- Frete e imposto desconhecidos nao viram zero.
- `npm.cmd run check` executado com resultado real reportado.

## Fase 2: Motor OpenAI Web Search
Objetivo: usar OpenAI Web Search como motor principal de descoberta e verificacao inicial.

Entregaveis:
- Configuracao segura de `OPENAI_API_KEY`, modelo, timeout, limite de candidatos e armazenamento de respostas.
- Prompt estruturado para retornar candidatos com evidencias clicaveis.
- Falha clara quando a busca OpenAI estiver desativada ou sem chave.
- Sanitizacao de erro sem token, chave, query sensivel ou dado pessoal.

Criterio de pronto:
- Busca sem OpenAI configurado falha de forma clara.
- Busca com OpenAI configurado retorna candidatos, nao ofertas finais automaticas.
- Toda evidencia possivel vem com URL HTTPS clicavel.

## Fase 3: Estados E Evidencias
Objetivo: transformar resultados web em estados honestos de produto.

Entregaveis:
- Estados: candidato encontrado, candidato verificavel, oferta completa, custo incompleto, precisa confirmacao e indisponivel.
- Evidencias por campo: produto, loja, preco, frete, imposto, disponibilidade e URL.
- Avisos publicos para lacunas de frete, imposto, disponibilidade e confirmacao.
- Testes para impedir promocao indevida de candidato incompleto.

Criterio de pronto:
- Item sem frete evidenciado vira `custo incompleto` ou `precisa confirmacao`.
- Item sem imposto evidenciado nao vira `oferta completa`.
- Item indisponivel nao entra no ranking principal.

## Fase 4: Ranking Transparente
Objetivo: ranquear apenas ofertas completas e separar candidatos uteis, mas incompletos.

Entregaveis:
- Calculo de custo total como produto + frete + imposto.
- Ordenacao das ofertas completas por custo total.
- Secao separada para candidatos verificaveis com custo incompleto.
- Explicacao do motivo de ranking com evidencia e avisos.

Criterio de pronto:
- Menor preco de vitrine perde para menor custo total real.
- Frete desconhecido e imposto desconhecido nunca entram como zero.
- `npm.cmd run check` passa com testes de ranking.

## Fase 5: Historico
Objetivo: permitir que o usuario acompanhe o que foi encontrado sem transformar captura antiga em verdade atual.

Entregaveis:
- Registro de busca com query, pais, moeda, filtros, estado dos candidatos e evidencias.
- Linha do tempo por produto pesquisado.
- Comparacao entre capturas com aviso de possivel mudanca de pagina.
- Mascara para CEP ou qualquer dado sensivel em respostas publicas e logs.

Criterio de pronto:
- Historico mostra data de captura e estado de cada item.
- Historico nao cria preco ausente nem estima queda sem nova captura.

## Fase 6: Alertas
Objetivo: transformar pesquisa manual em monitoramento honesto.

Entregaveis:
- Criacao, listagem, remocao e revalidacao manual de alertas.
- Alvo por custo total, moeda e contexto de entrega.
- Aviso separado para candidato promissor sem custo completo.
- Persistencia configuravel sem segredos no repositorio.

Criterio de pronto:
- Alerta de oferta so dispara com `oferta completa` revalidada.
- Candidato incompleto pode gerar aviso de confirmacao, nao alerta de oferta final.
- `npm.cmd run check` passa com testes de alerta.

## Fase 7: Confirmacao No Site Da Loja
Objetivo: fechar o fluxo com uma decisao segura para o usuario.

Entregaveis:
- CTA para abrir a evidencia principal no site da loja.
- Checklist de confirmacao: preco, frete, imposto, estoque, variacao e prazo.
- Registro opcional de confirmacao do usuario no historico.
- Aviso de que a SearchForPay nao faz checkout nem garante estoque.

Criterio de pronto:
- Toda oferta completa exibida tem link de confirmacao.
- Usuario entende o que ainda precisa conferir antes de comprar.

## Fase 8: Producao E Seguranca
Objetivo: operar a ferramenta sem vazar dados e sem sobrecarregar busca externa.

Entregaveis:
- Rate limit nas rotas de API.
- Timeouts de servidor e de OpenAI Web Search.
- Cache curto com identificacao de captura e sem alterar ranking.
- Logs sem query string sensivel, corpo, CEP completo, tokens ou chaves.
- `.env.example` sem segredos.
- Checklist de publicacao em `PRODUCTION.md`.

Criterio de pronto:
- Cache nao cria oferta nem mascara mudanca de estado.
- Erros publicos sao claros e seguros.
- `npm.cmd run check` passa.

## Fase 9: Remocao De Legado E Pos-MVP
Objetivo: alinhar o codigo ao posicionamento sem APIs de lojas.

Possiveis entregas:
- Remover ou isolar adaptadores legados de lojas, marketplaces, afiliados e feeds comerciais.
- Renomear variaveis historicas ligadas a marketplace sem quebrar migracao.
- Filtros por disponibilidade, prazo, confianca da evidencia e loja.
- Exportacao do historico.
- Notificacoes externas para alertas.

Nao fazer:
- Preencher lacunas com dados ficticios.
- Usar API de loja, marketplace, afiliado ou feed comercial.
- Assumir frete, imposto ou disponibilidade quando a fonte nao informar.
- Prometer precisao absoluta.
