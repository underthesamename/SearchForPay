# SearchForPay - Checklist De Producao

## Antes De Publicar

- Configurar somente provedores reais em `MARKETPLACE_PROVIDERS`.
- Preencher credenciais reais no ambiente de deploy, nunca no repositorio.
- Confirmar `REQUEST_TIMEOUT_MS` e timeouts especificos por provedor.
- Confirmar `RATE_LIMIT_ENABLED=true`.
- Definir `RATE_LIMIT_MAX_REQUESTS` conforme trafego esperado.
- Usar cache distribuido no edge/proxy quando houver mais de uma instancia.
- Manter `SEARCH_CACHE_TTL_MS` curto para nao esconder mudanca real de oferta.
- Confirmar `REQUEST_LOGGING_ENABLED=true` sem query string, corpo ou headers sensiveis.
- Usar HTTPS no dominio publico e proxy reverso com limites de corpo e conexao.
- Se usar proxy, configurar `TRUST_PROXY_HEADERS=true` somente quando o proxy reescrever `X-Forwarded-For`.
- Proteger `.searchforpay/price-alerts.json` ou substituir por banco com controle de acesso.
- Rodar `npm.cmd run check` no ambiente de build.

## Operacao

- Monitorar taxa de `SERVICE_UNAVAILABLE` por provedor.
- Monitorar `RATE_LIMITED` para ajustar limites sem abrir abuso.
- Revisar logs para confirmar ausencia de CEP, token, chave e corpo de requisicao.
- Rotacionar credenciais dos provedores em secret manager.
- Validar uma busca real por provedor antes de liberar trafego.
