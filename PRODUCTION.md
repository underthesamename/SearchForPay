# SearchForPay - Checklist De Producao

## Antes De Publicar

- Usar `SEARCH_MODE=web_research`; `MARKETPLACE_PROVIDERS` e legado e nao deve ser exigido no fluxo principal.
- Preencher `OPENAI_API_KEY` somente no ambiente de deploy ou secret manager, nunca no repositorio, frontend, cache ou historico.
- Confirmar `OPENAI_SEARCH_ENABLED=true`.
- Manter `OPENAI_STORE_RESPONSES=false` para nao armazenar payload bruto da OpenAI.
- Confirmar `REQUEST_TIMEOUT_MS`, `OPENAI_SEARCH_TIMEOUT_MS` e timeouts do servidor.
- Confirmar `RATE_LIMIT_ENABLED=true`.
- Definir `RATE_LIMIT_MAX_REQUESTS` conforme trafego esperado.
- Definir `OPENAI_SEARCH_RATE_LIMIT_MAX_REQUESTS` abaixo do teto financeiro aceitavel por janela.
- Manter `OPENAI_SEARCH_MAX_CANDIDATES` baixo o suficiente para controlar custo e latencia.
- Usar cache distribuido no edge/proxy quando houver mais de uma instancia.
- Manter `SEARCH_CACHE_TTL_MS` curto; cache so pode guardar resposta publica sanitizada.
- Confirmar `REQUEST_LOGGING_ENABLED=true` sem query string, corpo, CEP completo, headers sensiveis, token ou chave.
- Usar HTTPS no dominio publico e proxy reverso com limites de corpo e conexao.
- Se usar proxy, configurar `TRUST_PROXY_HEADERS=true` somente quando o proxy reescrever `X-Forwarded-For`.
- Proteger `.searchforpay/price-alerts.json` ou substituir por banco com controle de acesso.
- Rodar `npm.cmd run check` no ambiente de build.

## Variaveis De Producao

Obrigatorias para busca real:

- `SEARCH_MODE=web_research`
- `OPENAI_SEARCH_ENABLED=true`
- `OPENAI_API_KEY`: segredo do servidor. Nao enviar ao navegador e nao gravar em arquivo versionado.
- `OPENAI_SEARCH_MODEL`
- `OPENAI_SEARCH_CONTEXT_SIZE`
- `OPENAI_SEARCH_MAX_CANDIDATES`
- `OPENAI_SEARCH_TIMEOUT_MS`
- `OPENAI_SEARCH_RATE_LIMIT_WINDOW_MS`
- `OPENAI_SEARCH_RATE_LIMIT_MAX_REQUESTS`
- `OPENAI_STORE_RESPONSES=false`

Controles HTTP e privacidade:

- `REQUEST_BODY_LIMIT_BYTES`
- `REQUEST_LOGGING_ENABLED`
- `RATE_LIMIT_ENABLED`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `TRUST_PROXY_HEADERS`
- `SEARCH_CACHE_ENABLED`
- `SEARCH_CACHE_TTL_MS`
- `SEARCH_CACHE_MAX_ENTRIES`
- `SERVER_REQUEST_TIMEOUT_MS`
- `SERVER_HEADERS_TIMEOUT_MS`
- `SERVER_KEEP_ALIVE_TIMEOUT_MS`

Alertas:

- `PRICE_ALERTS_ENABLED`
- `PRICE_ALERTS_FILE`
- `PRICE_ALERT_JOB_INTERVAL_MS`
- `PRICE_ALERT_RECHECK_INTERVAL_MS`

## Limites De Custo

- Cada busca web pode chamar OpenAI Web Search e consumir custo externo; nao existe fallback ficticio.
- `OPENAI_SEARCH_MAX_CANDIDATES` limita quantos candidatos o prompt pede e quantos o backend aceita.
- `OPENAI_SEARCH_TIMEOUT_MS` limita latencia e evita chamada pendurada.
- `OPENAI_SEARCH_RATE_LIMIT_WINDOW_MS` e `OPENAI_SEARCH_RATE_LIMIT_MAX_REQUESTS` limitam chamadas OpenAI no processo.
- `RATE_LIMIT_WINDOW_MS` e `RATE_LIMIT_MAX_REQUESTS` limitam abuso por IP/cliente nas rotas `/api/`.
- `SEARCH_CACHE_TTL_MS` reduz repeticao imediata, mas deve ficar curto porque preco, frete, imposto e disponibilidade mudam.
- Em mais de uma instancia, mover rate limit/cache para Redis, edge ou gateway compartilhado antes de liberar trafego maior.

## Operacao

- Monitorar taxa de `SERVICE_UNAVAILABLE` da OpenAI Web Search.
- Monitorar `RATE_LIMITED` para ajustar limites sem abrir abuso.
- Revisar logs para confirmar ausencia de CEP completo, token, chave e corpo de requisicao.
- Rotacionar a chave OpenAI no secret manager.
- Validar uma busca real com evidencias HTTPS antes de liberar trafego.
