# SearchForPay

SearchForPay e uma ferramenta de pesquisa e verificacao de ofertas na web. O produto usa OpenAI Web Search como motor principal para encontrar candidatos reais, anexar evidencias clicaveis e separar o que esta completo do que ainda precisa ser confirmado no site da loja.

Ela nao usa APIs de lojas, marketplaces, afiliados ou feeds comerciais como base do produto. Ela tambem nao inventa loja, preco, frete, imposto, estoque ou disponibilidade.

## Estado atual

Este repositorio contem:

- API HTTP em Node.js puro.
- Interface web simples para busca.
- Motor `openaiweb` baseado na OpenAI Responses API com ferramenta `web_search`.
- Modelo de candidatos web com evidencias.
- Validacao para impedir que candidato incompleto vire oferta final.
- Ranking por custo total apenas quando produto, frete e imposto estao completos.
- Historico local e alertas de preco com rechecagem por OpenAI Web Search.

Observacao honesta: o codigo ainda pode conter adaptadores legados de marketplace criados antes do reposicionamento. Eles nao fazem parte do produto alvo. Nao habilite APIs de lojas, marketplaces, afiliados ou feeds comerciais.

## Comandos

```powershell
npm.cmd run check
npm.cmd run dev
```

Depois de iniciar:

- Interface: `http://localhost:3000`
- Saude da API: `http://localhost:3000/health`
- Busca: `http://localhost:3000/api/search?query=notebook&postalCode=01001000&country=BR&currency=BRL`
- Alertas: `http://localhost:3000/api/alerts`

Sem OpenAI Web Search configurado, a busca deve falhar de forma clara em vez de preencher a tela com dados falsos.

## Configuracao OpenAI Web Search

A integracao usa a Responses API com a ferramenta `web_search`, conforme a documentacao oficial da OpenAI: [Web search](https://developers.openai.com/api/docs/guides/tools-web-search).

Exemplo seguro de `.env`, sem chave real:

```dotenv
SEARCH_MODE=web_research
OPENAI_API_KEY=
OPENAI_SEARCH_ENABLED=false
OPENAI_SEARCH_MODEL=gpt-5.6
OPENAI_SEARCH_CONTEXT_SIZE=high
OPENAI_SEARCH_MAX_CANDIDATES=8
OPENAI_SEARCH_TIMEOUT_MS=15000
OPENAI_STORE_RESPONSES=false
```

Para uso real, configure `OPENAI_API_KEY` apenas no ambiente local ou servidor e altere `OPENAI_SEARCH_ENABLED=true`. Nunca coloque chave real no repositorio, no frontend, em logs ou em exemplos compartilhados.

`MARKETPLACE_PROVIDERS` e um nome historico do codigo legado. O caminho principal nao depende dele.

## Estados do produto

- `candidato encontrado`: a busca achou uma pagina ou trecho promissor, mas ainda falta verificacao.
- `candidato verificavel`: existe URL HTTPS clicavel, loja identificavel e evidencia para produto/preco.
- `oferta completa`: produto, loja, URL, preco, frete, imposto, moeda e disponibilidade estao evidenciados.
- `custo incompleto`: preco existe, mas frete ou imposto nao esta exposto; desconhecido nao vira zero.
- `precisa confirmacao`: o usuario precisa abrir o site da loja para confirmar um ponto decisivo.
- `indisponivel`: a fonte indica estoque ausente, compra indisponivel, link quebrado ou informacao conflitante.

## Fluxo do produto

1. Busca por produto, pais, moeda e contexto de entrega quando necessario.
2. OpenAI Web Search localiza paginas reais e fontes com evidencias.
3. O sistema registra links, titulos, trechos e horario de captura.
4. Candidatos sao normalizados sem completar lacunas por chute.
5. Cada item recebe um estado claro.
6. Apenas ofertas completas entram no ranking por custo total.
7. Candidatos com custo incompleto aparecem separados.
8. Historico salva capturas, estados, evidencias e avisos.
9. Alertas revalidam a busca ou candidato salvo antes de avisar que um alvo foi atingido.
10. O usuario confirma preco, frete, imposto, estoque e prazo no site da loja.

## Regras de oferta

Uma oferta completa precisa ter:

- Produto real.
- Loja ou vendedor real.
- URL HTTPS clicavel.
- Preco real evidenciado.
- Frete real evidenciado.
- Imposto real evidenciado.
- Moeda consistente.
- Disponibilidade evidenciada.

Frete desconhecido nao e zero. Imposto desconhecido nao e zero. Quando esses campos faltam, o item continua podendo ser util como candidato, mas nao como oferta final.

## Alertas de preco

Alertas podem ser criados pela busca atual ou por um candidato/oferta exibido na tela. O alerta salva query, contexto de entrega, custo alvo, moeda e, quando houver candidato, URL HTTPS e evidencias HTTPS.

O job periodico reconsulta OpenAI Web Search. Ele so marca `target_met` quando a rechecagem retorna fonte revalidada com evidencia clicavel e custo total completo dentro do alvo. Resultado sem evidencia, sem frete, sem imposto ou sem disponibilidade verificavel permanece pendente.

## Producao e seguranca

A API aplica protecoes basicas sem dependencia externa:

- Rate limit em memoria por cliente para rotas `/api/`.
- Cache curto apenas em `GET /api/search`, com chave interna em hash.
- Sanitizacao defensiva de erro HTTP, cache e logs para remover chave, token e CEP completo.
- Headers de seguranca para JSON e arquivos estaticos.
- Limite de corpo JSON em rotas que recebem payload.
- Timeouts do servidor HTTP e timeout da busca OpenAI.
- Logs sem query string sensivel, CEP completo, corpo, headers ou credenciais.
- Nenhum payload bruto da OpenAI e salvo; mantenha `OPENAI_STORE_RESPONSES=false`.

Limites de custo em producao:

- `OPENAI_SEARCH_MAX_CANDIDATES` controla quantos candidatos a pesquisa pode pedir e aceitar.
- `OPENAI_SEARCH_TIMEOUT_MS` corta chamadas lentas.
- `OPENAI_SEARCH_RATE_LIMIT_WINDOW_MS` e `OPENAI_SEARCH_RATE_LIMIT_MAX_REQUESTS` limitam chamadas OpenAI por janela.
- `RATE_LIMIT_WINDOW_MS` e `RATE_LIMIT_MAX_REQUESTS` limitam abuso das rotas `/api/`.
- `SEARCH_CACHE_TTL_MS` deve continuar curto porque oferta, frete, imposto e estoque mudam.

Para publicar, siga [PRODUCTION.md](./PRODUCTION.md). Em mais de uma instancia, mover rate limit/cache para infraestrutura compartilhada.

## Estrutura

```text
public/                 Interface web
scripts/                Verificacoes locais
src/config/             Leitura de ambiente
src/http/               App HTTP, respostas e arquivos estaticos
src/modules/ai-search/  Pesquisa web com OpenAI
src/modules/offers/     Validacao e ranking de ofertas
src/modules/pricing/    Calculo de custo total
src/modules/providers/  Registro tecnico atual de motores/provedores
src/modules/search/     Fluxo de busca
src/shared/             Erros e validacoes comuns
tests/                  Testes de regras criticas
```

## Proximo passo tecnico

Alinhar o codigo ao reposicionamento: manter `openaiweb` como motor principal, remover ou isolar adaptadores legados de APIs comerciais e garantir que historico, alertas, revalidacao e confirmacao no site sigam os estados definidos em `PRODUCT.md`.
