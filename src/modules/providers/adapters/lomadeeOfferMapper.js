import { LOMADEE_PROVIDER_NAME, LOMADEE_SOURCE } from './lomadeeConfig.js';
import { isHttpsUrl, sameCurrency, textMatchesQuery } from './adapterUtils.js';

const SHIPPING_KEYS = new Set([
  'shipping',
  'shippingcost',
  'shippingprice',
  'freight',
  'freightcost',
  'freightprice',
  'frete',
  'fretevalor',
  'delivery',
  'deliverycost',
  'deliveryprice'
]);

const TAX_KEYS = new Set([
  'tax',
  'taxes',
  'taxamount',
  'taxesamount',
  'taxcost',
  'imposto',
  'impostos',
  'impostovalor'
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCents(value) {
  if (Number.isInteger(value) && value >= 0) {
    return value;
  }

  const text = String(value ?? '').trim();

  if (/^\d+$/.test(text)) {
    return Number.parseInt(text, 10);
  }

  return undefined;
}

function moneyFromValue(value, currency) {
  if (isPlainObject(value)) {
    const objectCurrency = String(value.currency || value.currencyCode || currency).toUpperCase();

    if (objectCurrency !== currency) {
      return undefined;
    }

    return moneyFromValue(
      value.amountCents ?? value.valueCents ?? value.priceCents ?? value.amount ?? value.value ?? value.price,
      currency
    );
  }

  const amountCents = parseCents(value);

  return amountCents === undefined ? undefined : {
    amountCents,
    currency
  };
}

function moneyFromKnownKey(container, acceptedKeys, currency) {
  if (!isPlainObject(container)) {
    return undefined;
  }

  for (const [key, value] of Object.entries(container)) {
    if (acceptedKeys.has(normalizeKey(key))) {
      const money = moneyFromValue(value, currency);

      if (money) {
        return money;
      }
    }
  }

  return undefined;
}

function metadataMoney(container, acceptedKeys, currency) {
  if (!Array.isArray(container?.metadata)) {
    return undefined;
  }

  for (const entry of container.metadata) {
    if (!isPlainObject(entry)) {
      continue;
    }

    const explicitKey = entry.key ?? entry.name ?? entry.code ?? entry.type ?? entry.field ?? entry.label;

    if (acceptedKeys.has(normalizeKey(explicitKey))) {
      const money = moneyFromValue(
        entry.value ?? entry.amountCents ?? entry.valueCents ?? entry.amount ?? entry.price,
        currency
      );

      if (money) {
        return money;
      }
    }

    const directMoney = moneyFromKnownKey(entry, acceptedKeys, currency);

    if (directMoney) {
      return directMoney;
    }
  }

  return undefined;
}

function chooseMoney(containers, acceptedKeys, currency) {
  return containers
    .flatMap((container) => [
      moneyFromKnownKey(container, acceptedKeys, currency),
      metadataMoney(container, acceptedKeys, currency)
    ])
    .filter(Boolean)
    .sort((left, right) => left.amountCents - right.amountCents)[0];
}

function unexposedShipping(currency) {
  return {
    amountCents: 0,
    currency,
    exposed: false,
    warning: 'Frete nao exposto pela Lomadee; compare como subtotal conhecido.'
  };
}

function pricingMoney(pricing, currency) {
  return moneyFromValue(pricing?.price, currency);
}

function choosePricing(option, product, currency) {
  return [...(option.pricing || []), ...(option === product ? [] : product.pricing || [])]
    .map((pricing) => ({
      pricing,
      money: pricingMoney(pricing, currency)
    }))
    .filter((entry) => entry.money?.amountCents > 0)
    .sort((left, right) => left.money.amountCents - right.money.amountCents)[0];
}

function hasStock(option) {
  if (!Array.isArray(option.stocks) || option.stocks.length === 0) {
    return true;
  }

  return option.stocks.some((stock) => Number.parseInt(String(stock?.value ?? ''), 10) > 0);
}

function getOptions(product) {
  if (Array.isArray(product.options) && product.options.length > 0) {
    return product.options;
  }

  return [product];
}

function normalizeLomadeeOptionOffer({ product, option, searchRequest, currency }) {
  if (product.available === false || option.available === false || !hasStock(option)) {
    return undefined;
  }

  const productTitle = option.name || product.name;
  const searchableText = [product.name, product.description, option.name].filter(Boolean).join(' ');

  if (!textMatchesQuery(searchableText, searchRequest.normalizedQuery)) {
    return undefined;
  }

  const pricing = choosePricing(option, product, currency);
  const price = pricing?.money;
  const containers = [pricing?.pricing, option, product].filter(Boolean);
  const shipping = chooseMoney(containers, SHIPPING_KEYS, currency) || unexposedShipping(currency);
  const taxes = chooseMoney(containers, TAX_KEYS, currency);
  const sellerName = option.seller || product.seller || product.organizationId;
  const productUrl = product.url;

  if (
    !productTitle ||
    !price ||
    !shipping ||
    !taxes ||
    !sameCurrency(price, shipping, taxes) ||
    !sellerName ||
    !isHttpsUrl(productUrl)
  ) {
    return undefined;
  }

  const offer = {
    providerName: LOMADEE_PROVIDER_NAME,
    source: LOMADEE_SOURCE,
    productTitle,
    productUrl,
    price,
    shipping,
    taxes,
    seller: { name: sellerName }
  };

  if (shipping.exposed === false) {
    offer.warnings = [shipping.warning];
  }

  return offer;
}

export function normalizeLomadeeProductOffers({ product, searchRequest, currency }) {
  if (!isPlainObject(product)) {
    return [];
  }

  return getOptions(product)
    .map((option) => normalizeLomadeeOptionOffer({ product, option, searchRequest, currency }))
    .filter(Boolean);
}
