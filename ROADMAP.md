# SearchForPay - Roadmap

## Fase 1: Fundacao Do Produto

Objetivo: transformar a ideia em uma especificacao operacional e verificavel.

Entregaveis:

- `PRODUCT.md` com visao, publico, problema, fluxo principal, oferta valida, fontes reais, calculo de custo total e limites do MVP.
- Roadmap por fases.
- Definicao clara de que uma oferta valida precisa vir de provedor real configurado e conter preco, frete e imposto.

Criterio de pronto:

- Documentos criados sem prometer dados ficticios.
- Regras alinhadas com `GLOBAL.md`, `AGENTS.md`, `SFP.md` e o contrato tecnico atual.
- `npm.cmd run check` executado com resultado real reportado.

## Fase 2: Contrato De Provedores Reais

Objetivo: preparar a base para conectar fontes reais sem contaminar o sistema com mocks.

Entregaveis:

- Adaptador real em `src/modules/providers/adapters/`.
- Registro do adaptador em `providerRegistry`.
- Configuracao por `MARKETPLACE_PROVIDERS`.
- Tratamento explicito para provedor desconhecido, indisponivel ou com resposta invalida.
- Documentacao de variaveis de ambiente necessarias, sem registrar segredos.

Criterio de pronto:

- Busca falha claramente quando o provedor nao esta configurado.
- Nenhuma oferta exibida vem de dado manual ou inventado.
- Erros publicos nao expoem tokens, chaves ou dados pessoais.

## Fase 3: Busca Real E Normalizacao

Objetivo: consultar uma fonte real e converter a resposta para o contrato interno da SearchForPay.

Entregaveis:

- Busca por texto do produto.
- Envio de contexto necessario para frete e imposto, como CEP quando a fonte exigir.
- Normalizacao de ofertas para `providerName`, `productTitle`, `productUrl`, `price`, `shipping` e `taxes`.
- Descarte de ofertas incompletas.
- Relatorio por provedor com status e quantidade de ofertas validas.

Criterio de pronto:

- Uma busca com provedor real retorna apenas ofertas validas.
- Uma resposta sem frete ou imposto nao entra no ranking.
- Falha do provedor nao derruba a API inteira quando outros provedores responderem corretamente.

## Fase 4: Ranking Por Custo Total

Objetivo: garantir que a melhor oferta seja definida pelo custo real para o usuario.

Entregaveis:

- Calculo de custo total como preco do produto + frete + imposto.
- Ordenacao crescente pelo custo total.
- Retorno das 3 melhores ofertas validas.
- Detalhamento de produto, frete, imposto e total na resposta.
- Testes cobrindo frete e imposto como parte obrigatoria do custo.

Criterio de pronto:

- Oferta com menor preco de vitrine perde posicao quando o custo total for maior.
- Todas as ofertas ranqueadas possuem moeda consistente.
- Testes passam com `npm.cmd run check`.

## Fase 5: Experiencia MVP

Objetivo: tornar a busca utilizavel por uma pessoa real, sem esconder limites do sistema.

Entregaveis:

- Interface simples para produto e contexto de entrega.
- Estados de carregamento, sucesso, erro e vazio.
- Exibicao das 3 melhores ofertas com custo total em destaque.
- Separacao visual entre preco, frete e imposto.
- Mensagens claras quando nao houver provedor real configurado ou nenhuma oferta valida.

Criterio de pronto:

- Usuario consegue fazer uma busca real pelo navegador.
- Nenhuma area da interface depende de oferta falsa.
- Erros ajudam o usuario ou operador a entender o problema sem vazar dados sensiveis.

## Fase 6: Confianca E Operacao

Objetivo: preparar o sistema para uso continuo com mais de uma fonte real.

Entregaveis:

- Logs tecnicos sem segredos.
- Metadados de busca com horario, provedores consultados e ofertas ignoradas.
- Timeout por provedor.
- Testes de falha parcial.
- Base para adicionar novos adaptadores sem mudar o fluxo principal.

Criterio de pronto:

- Um provedor lento ou indisponivel nao bloqueia todos os resultados.
- O sistema informa quais provedores falharam de forma publica e segura.
- Novos adaptadores seguem o mesmo contrato.

## Fase 7: Alertas De Preco

Objetivo: evoluir de busca manual para acompanhamento ativo sem inventar variacao de preco.

Entregaveis:

- Modelo de alerta com busca salva, contexto de entrega e custo total alvo.
- Persistencia local em arquivo JSON configuravel por ambiente.
- Rotas para listar, criar, remover e revalidar alerta.
- Job periodico que reconsulta provedores reais pelo motor de busca.
- Status de alvo atingido somente quando a melhor oferta valida fica menor ou igual ao alvo.

Criterio de pronto:

- Alerta nao dispara sem reconsulta real.
- Falta de provedor real vira erro claro salvo no alerta.
- CEP nao aparece em log ou resposta publica nao mascarada.
- `npm.cmd run check` passa com testes de alerta.

## Fase 8: Producao E Seguranca

Objetivo: deixar a ferramenta pronta para uso real com protecoes basicas.

Entregaveis:

- Rate limit nas rotas de API.
- Timeout global de servidor e timeout por provedor.
- Cache curto para busca manual sem afetar revalidacao de alertas.
- Logs tecnicos sem query string, corpo, CEP, tokens ou chaves.
- `.env.example` completo e sem segredos.
- Checklist de publicacao em `PRODUCTION.md`.

Criterio de pronto:

- Busca continua falhando claramente sem provedor real.
- Cache nao cria oferta nem altera ranking.
- `npm.cmd run check` passa.

## Fase 9: Pos-MVP

Objetivo: expandir valor sem comprometer a regra de fontes reais.

Possiveis entregas:

- Mais provedores reais.
- Historico de preco.
- Notificacao externa para alertas.
- Filtros por prazo, reputacao do vendedor e disponibilidade.
- Melhor tratamento de equivalencia entre produtos parecidos.
- Suporte a cupons ou cashback apenas quando retornados por fonte real confiavel.

Nao fazer nesta fase:

- Preencher lacunas com dados ficticios.
- Assumir frete ou imposto quando a fonte nao informar.
- Criar ranking por patrocinio sem sinalizacao explicita ao usuario.
