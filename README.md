# SearchForPay

SearchForPay e uma ferramenta para comparar ofertas reais de produtos na internet. Ela consulta provedores confiaveis, calcula o custo total considerando produto, frete e imposto, e apresenta as 3 melhores opcoes para o usuario.

## Estado atual

Este repositorio contem o esqueleto inicial do sistema:

- API HTTP em Node.js puro.
- Interface web simples para busca.
- Contrato de provedores reais.
- Adaptadores reais: eBay Browse API, Shopify Storefront API e Google Merchant API.
- Ranking por custo total.
- Validacao para impedir ofertas incompletas ou ficticias.

Nenhuma oferta e inventada. Sem credencial real do provedor, a busca falha de forma clara.

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

Enquanto `MARKETPLACE_PROVIDERS` estiver vazio, a busca retorna erro claro informando que nao ha provedor real configurado.

## Producao e seguranca

A API aplica protecoes basicas sem dependencia externa:

- Rate limit em memoria por cliente para rotas `/api/`.
- Cache curto apenas em `GET /api/search`, com chave interna em hash.
- Headers de seguranca para JSON e arquivos estaticos.
- Limite de corpo JSON em rotas que recebem payload.
- Timeouts do servidor HTTP e timeout por provedor.
- Logs de requisicao sem query string, CEP, corpo, headers ou credenciais.

Variaveis principais:

```dotenv
REQUEST_BODY_LIMIT_BYTES=16384
REQUEST_LOGGING_ENABLED=true
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=60
TRUST_PROXY_HEADERS=false
SEARCH_CACHE_ENABLED=true
SEARCH_CACHE_TTL_MS=30000
SEARCH_CACHE_MAX_ENTRIES=100
SERVER_REQUEST_TIMEOUT_MS=30000
SERVER_HEADERS_TIMEOUT_MS=35000
SERVER_KEEP_ALIVE_TIMEOUT_MS=5000
```

Para publicar, siga [PRODUCTION.md](./PRODUCTION.md). Em mais de uma instancia, mover rate limit/cache para infraestrutura compartilhada.

## Provedor eBay

Os provedores reais disponiveis sao `ebay`, `shopify` e `googlemerchant`. Ative somente provedores com credencial real em `MARKETPLACE_PROVIDERS`.

### eBay

Baseado no eBay Browse API. Configure via `.env`:

```dotenv
MARKETPLACE_PROVIDERS=ebay
EBAY_ENVIRONMENT=production
EBAY_MARKETPLACE_ID=EBAY_US
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_BROWSE_ACCESS_TOKEN=
EBAY_SEARCH_LIMIT=10
EBAY_REQUEST_TIMEOUT_MS=8000
```

Use `EBAY_CLIENT_ID` e `EBAY_CLIENT_SECRET` para OAuth client credentials, ou `EBAY_BROWSE_ACCESS_TOKEN` quando ja houver um token de aplicacao valido. O adapter usa endpoints oficiais por padrao e rejeita override sem HTTPS.

Para a oferta entrar no ranking, o retorno real do eBay precisa trazer preco, frete, imposto calculavel, moeda, vendedor, URL HTTPS e origem. Se imposto ou frete nao vierem da API de forma calculavel, a oferta e descartada.

### Shopify

Baseado no Shopify Storefront API. Configure uma loja real:

```dotenv
MARKETPLACE_PROVIDERS=shopify
SHOPIFY_STORE_DOMAIN=
SHOPIFY_STOREFRONT_ACCESS_TOKEN=
SHOPIFY_API_VERSION=2026-07
SHOPIFY_SEARCH_LIMIT=5
SHOPIFY_QUOTE_LIMIT=3
SHOPIFY_REQUEST_TIMEOUT_MS=8000
```

O adapter busca produtos no Storefront API e cria carrinhos para estimar frete e imposto. Sem `onlineStoreUrl`, frete ou imposto retornados pela API, a oferta e descartada.

### Google Merchant

Baseado no Google Merchant API. Configure uma conta real:

```dotenv
MARKETPLACE_PROVIDERS=googlemerchant
GOOGLE_MERCHANT_ACCOUNT_ID=
GOOGLE_MERCHANT_ACCESS_TOKEN=
GOOGLE_MERCHANT_PAGE_SIZE=25
GOOGLE_MERCHANT_REQUEST_TIMEOUT_MS=8000
```

O adapter lista produtos processados da conta Merchant Center e usa preco, frete e impostos declarados nos atributos do produto. Sem esses campos reais, a oferta e descartada.

## Alertas de preco

Alertas salvam busca, CEP, pais, moeda e custo total alvo para reconsulta periodica. O alerta so fica como atingido quando uma nova consulta aos provedores reais retorna oferta valida com custo total menor ou igual ao alvo.

Configuracao opcional:

```dotenv
PRICE_ALERTS_ENABLED=true
PRICE_ALERTS_FILE=.searchforpay/price-alerts.json
PRICE_ALERT_JOB_INTERVAL_MS=300000
PRICE_ALERT_RECHECK_INTERVAL_MS=3600000
```

O arquivo local guarda o contexto necessario para recalcular frete e imposto. A API publica mascara o CEP na listagem e o job nao registra dados pessoais em log.

## Estrutura

```text
public/                 Interface web
scripts/                Verificacoes locais
src/config/             Leitura de ambiente
src/http/               App HTTP, respostas e arquivos estaticos
src/modules/offers/     Validacao e ranking de ofertas
src/modules/pricing/    Calculo de custo total
src/modules/providers/  Contrato e registro de provedores reais
src/modules/search/     Fluxo de busca
src/shared/             Erros e validacoes comuns
tests/                  Testes de regras criticas
```

## Proximo passo tecnico

Validar uma credencial real do eBay em ambiente local e depois adicionar novos provedores reais sem relaxar o contrato de oferta valida.
