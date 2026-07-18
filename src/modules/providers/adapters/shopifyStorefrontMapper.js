import { isHttpsUrl, parseDecimalMoney, sameCurrency } from './adapterUtils.js';
import { SHOPIFY_PROVIDER_NAME, SHOPIFY_STOREFRONT_SOURCE } from './shopifyStorefrontConfig.js';

export function firstAvailableVariant(product, currency) {
  return (product.variants?.edges || [])
    .map((edge) => edge.node)
    .find((variant) => {
      const price = parseDecimalMoney(variant?.price?.amount, variant?.price?.currencyCode);
      return variant?.availableForSale === true && price?.currency === currency;
    });
}

function cheapestShipping(cart, currency) {
  return (cart.deliveryGroups?.edges || [])
    .flatMap((edge) => edge.node?.deliveryOptions || [])
    .map((option) => parseDecimalMoney(option.estimatedCost?.amount, option.estimatedCost?.currencyCode))
    .filter((money) => money?.currency === currency)
    .sort((left, right) => left.amountCents - right.amountCents)[0];
}

export function cartInput(variantId, context) {
  return {
    buyerIdentity: { countryCode: context.country },
    delivery: {
      addresses: [{
        address: {
          deliveryAddress: {
            countryCode: context.country,
            zip: context.postalCode
          }
        },
        oneTimeUse: true,
        selected: true
      }]
    },
    lines: [{ merchandiseId: variantId, quantity: 1 }]
  };
}

export function normalizeShopifyOffer({ product, variant, cart, shopName, searchRequest }) {
  const price = parseDecimalMoney(variant.price?.amount, variant.price?.currencyCode);
  const shipping = cheapestShipping(cart, searchRequest.context.currency);
  const taxes = parseDecimalMoney(cart.cost?.totalTaxAmount?.amount, cart.cost?.totalTaxAmount?.currencyCode);

  if (
    !price ||
    !shipping ||
    !taxes ||
    !sameCurrency(price, shipping, taxes) ||
    price.currency !== searchRequest.context.currency ||
    !shopName ||
    !isHttpsUrl(product.onlineStoreUrl)
  ) {
    return undefined;
  }

  return {
    providerName: SHOPIFY_PROVIDER_NAME,
    source: SHOPIFY_STOREFRONT_SOURCE,
    productTitle: product.title,
    productUrl: product.onlineStoreUrl,
    price,
    shipping,
    taxes,
    seller: { name: shopName }
  };
}
