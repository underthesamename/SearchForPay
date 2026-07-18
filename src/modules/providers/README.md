# Provedores reais

Adaptadores de marketplace devem ficar em `src/modules/providers/adapters/`.

Cada adaptador precisa seguir o modelo de Provider:

```js
{
  name: '<nome configurado em MARKETPLACE_PROVIDERS>',
  source: {
    type: 'api',
    name: '<nome da fonte real>'
  },
  async search(searchRequest) {
    return [];
  }
}
```

O `searchRequest` recebido pelo adaptador segue este formato:

```js
{
  query: '<termo normalizado para exibicao>',
  normalizedQuery: '<termo normalizado para comparacao>',
  context: {
    postalCode: '<CEP normalizado>',
    country: '<pais ISO com 2 letras>',
    currency: '<moeda ISO com 3 letras>'
  }
}
```

Cada adaptador precisa retornar ofertas normalizadas com estes campos minimos:

```js
{
  providerName: '<mesmo name do provedor configurado>',
  source: {
    type: 'api',
    name: '<nome da fonte real>',
    url: '<URL HTTPS publica da fonte, quando existir>'
  },
  productTitle: '<nome real do produto retornado pela fonte>',
  productUrl: '<URL HTTPS real da oferta>',
  price: { amountCents: '<inteiro maior que zero>', currency: 'BRL' },
  shipping: { amountCents: '<inteiro maior ou igual a zero>', currency: 'BRL' },
  taxes: { amountCents: '<inteiro maior ou igual a zero>', currency: 'BRL' },
  seller: { name: '<nome real da loja ou vendedor>' },
  delivery: { minDays: '<inteiro opcional>', maxDays: '<inteiro opcional>' }
}
```

Regras:

- Nao retornar dados simulados.
- Tipos de fonte aceitos: `api`, `feed`, `affiliate` ou `partner`.
- Se frete ou imposto nao puderem ser calculados com fonte real, a oferta deve ser descartada ou marcada como erro no adaptador.
- `providerName` da oferta precisa bater com o `name` do provedor configurado.
- `productUrl` precisa ser HTTPS.
- `price`, `shipping` e `taxes` precisam usar a mesma moeda em codigo ISO de 3 letras.
- `seller.name` e `source.name` sao obrigatorios para a oferta entrar no ranking.
- Nao registrar chaves de API em logs.
- Registrar o adaptador real em `providerRegistry.js` e ativar pelo `MARKETPLACE_PROVIDERS`.

## Adapter `ebay`

Fonte real: eBay Browse API.

Documentacao oficial usada:

- Browse API: `https://www.developer.ebay.com/api-docs/buy/static/api-browse.html`
- OAuth client credentials: `https://developer.ebay.com/develop/guides-v2/authorization`
- ItemSummary: `https://developer.ebay.com/api-docs/buy/browse/types/gct%3AItemSummary`
- Taxes: `https://developer.ebay.com/api-docs/buy/browse/types/gct%3ATaxes`

Configuracao `.env`:

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

Regras especificas:

- O adapter usa `/item_summary/search` para buscar itens e `/item/{itemId}` para buscar detalhes.
- `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` geram token OAuth por client credentials; `EBAY_BROWSE_ACCESS_TOKEN` pode ser usado quando o token ja existe.
- `EBAY_REQUEST_TIMEOUT_MS` define timeout por chamada.
- `EBAY_BROWSE_BASE_URL` e `EBAY_OAUTH_BASE_URL` sao opcionais; quando informados, precisam ser HTTPS.
- Erros externos retornam mensagem sanitizada, sem token, client secret ou payload bruto do marketplace.
- Ofertas sem preco, frete, imposto calculavel, moeda consistente, vendedor, URL HTTPS ou origem real sao descartadas antes do ranking.

## Adapter `shopify`

Fonte real: Shopify Storefront API.

Documentacao oficial usada:

- Products query: `https://shopify.dev/docs/api/storefront/latest/queries/products`
- cartCreate: `https://shopify.dev/docs/api/storefront/latest/mutations/cartcreate`
- Cart cost: `https://shopify.dev/docs/api/storefront/latest/objects/cartcost`
- Delivery option: `https://shopify.dev/docs/api/storefront/latest/objects/cartdeliveryoption`

Configuracao `.env`:

```dotenv
MARKETPLACE_PROVIDERS=shopify
SHOPIFY_STORE_DOMAIN=
SHOPIFY_STOREFRONT_ACCESS_TOKEN=
SHOPIFY_API_VERSION=2026-07
SHOPIFY_SEARCH_LIMIT=5
SHOPIFY_QUOTE_LIMIT=3
SHOPIFY_REQUEST_TIMEOUT_MS=8000
```

Regras especificas:

- O adapter usa `products` para localizar produtos e `cartCreate` para cotar custo por variante.
- A loja precisa retornar `onlineStoreUrl`, preco da variante, opcao de entrega com custo estimado e imposto total do carrinho.
- Se o carrinho nao retornar frete ou imposto, a oferta e descartada.
- Erros GraphQL ou HTTP sao sanitizados e nao expoem `SHOPIFY_STOREFRONT_ACCESS_TOKEN`.

## Adapter `googlemerchant`

Fonte real: Google Merchant API.

Documentacao oficial usada:

- Products list: `https://developers.google.com/merchant/api/reference/rest/products_v1beta/accounts.products/list`
- Product resource: `https://developers.google.com/merchant/api/reference/rest/products_v1beta/accounts.products`
- Attributes shipping/taxes: `https://developers.google.com/merchant/api/reference/rest/products_v1beta/Attributes`
- Account resource: `https://developers.google.com/merchant/api/reference/rest/accounts_v1/accounts`

Configuracao `.env`:

```dotenv
MARKETPLACE_PROVIDERS=googlemerchant
GOOGLE_MERCHANT_ACCOUNT_ID=
GOOGLE_MERCHANT_ACCESS_TOKEN=
GOOGLE_MERCHANT_PAGE_SIZE=25
GOOGLE_MERCHANT_REQUEST_TIMEOUT_MS=8000
```

Regras especificas:

- O adapter usa `accounts.get` para obter o nome real da conta e `accounts.products.list` para listar produtos processados.
- A busca por termo e feita sobre titulo, descricao e marca retornados pelo Merchant API.
- Preco vem de `salePrice` ou `price`; frete vem de `shipping` ou `freeShippingThreshold`; imposto vem de `taxes`.
- Ofertas sem link HTTPS, preco, frete ou imposto aplicavel ao pais/CEP da busca sao descartadas.
- Erros externos sao sanitizados e nao expoem `GOOGLE_MERCHANT_ACCESS_TOKEN`.
