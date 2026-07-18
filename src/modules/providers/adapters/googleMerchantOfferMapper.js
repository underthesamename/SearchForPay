import {
  GOOGLE_MERCHANT_PROVIDER_NAME,
  GOOGLE_MERCHANT_SOURCE
} from './googleMerchantConfig.js';
import {
  isHttpsUrl,
  parseMicrosMoney,
  sameCurrency,
  textMatchesQuery
} from './adapterUtils.js';

function getAttributes(product) {
  return product.attributes || product.productAttributes || {};
}

function postalMatches(pattern, postalCode) {
  if (!pattern) {
    return true;
  }

  const normalizedPattern = String(pattern).replace(/\s+/g, '').toUpperCase();
  const normalizedPostal = String(postalCode).replace(/\s+/g, '').toUpperCase();

  if (normalizedPattern.endsWith('*')) {
    return normalizedPostal.startsWith(normalizedPattern.slice(0, -1));
  }

  if (/^\d+-\d+$/.test(normalizedPattern) && /^\d+$/.test(normalizedPostal)) {
    const [start, end] = normalizedPattern.split('-').map(Number);
    const current = Number(normalizedPostal);
    return current >= start && current <= end;
  }

  return normalizedPattern === normalizedPostal;
}

function choosePrice(attributes, currency) {
  return [attributes.salePrice, attributes.price]
    .map(parseMicrosMoney)
    .find((money) => money?.currency === currency && money.amountCents > 0);
}

function chooseShipping(attributes, searchRequest) {
  const price = choosePrice(attributes, searchRequest.context.currency);
  const shipping = (attributes.shipping || [])
    .filter((entry) => !entry.country || entry.country === searchRequest.context.country)
    .filter((entry) => postalMatches(entry.postalCode, searchRequest.context.postalCode))
    .map((entry) => ({
      entry,
      money: parseMicrosMoney(entry.price)
    }))
    .filter((item) => item.money?.currency === searchRequest.context.currency)
    .sort((left, right) => left.money.amountCents - right.money.amountCents)[0];

  if (shipping) {
    return shipping;
  }

  return (attributes.freeShippingThreshold || [])
    .filter((entry) => !entry.country || entry.country === searchRequest.context.country)
    .map((entry) => parseMicrosMoney(entry.priceThreshold))
    .find((threshold) => price && threshold?.currency === price.currency && price.amountCents >= threshold.amountCents)
    ? { entry: {}, money: { amountCents: 0, currency: searchRequest.context.currency } }
    : undefined;
}

function calculateTaxes(attributes, price, shipping, searchRequest) {
  const matchingTaxes = (attributes.taxes || [])
    .filter((tax) => !tax.country || tax.country === searchRequest.context.country)
    .filter((tax) => postalMatches(tax.postalCode, searchRequest.context.postalCode))
    .map((tax) => ({
      tax,
      rate: Number.parseFloat(String(tax.rate ?? ''))
    }))
    .filter((entry) => Number.isFinite(entry.rate) && entry.rate >= 0);

  if (matchingTaxes.length === 0) {
    return undefined;
  }

  return {
    amountCents: matchingTaxes.reduce((sum, entry) => {
      const base = price.amountCents + (entry.tax.taxShip === true ? shipping.amountCents : 0);
      return sum + Math.round(base * (entry.rate / 100));
    }, 0),
    currency: price.currency,
    taxSource: 'googleMerchant.attributes.taxes',
    taxRates: matchingTaxes.map((entry) => String(entry.tax.rate))
  };
}

function deliveryFromShipping(shippingEntry) {
  const timeFields = [
    shippingEntry.minHandlingTime,
    shippingEntry.maxHandlingTime,
    shippingEntry.minTransitTime,
    shippingEntry.maxTransitTime
  ];

  if (timeFields.every((value) => value === undefined || value === null || value === '')) {
    return undefined;
  }

  const minHandling = Number.parseInt(String(shippingEntry.minHandlingTime ?? '0'), 10);
  const maxHandling = Number.parseInt(String(shippingEntry.maxHandlingTime ?? '0'), 10);
  const minTransit = Number.parseInt(String(shippingEntry.minTransitTime ?? '0'), 10);
  const maxTransit = Number.parseInt(String(shippingEntry.maxTransitTime ?? '0'), 10);

  if (![minHandling, maxHandling, minTransit, maxTransit].every(Number.isFinite)) {
    return undefined;
  }

  return {
    minDays: minHandling + minTransit,
    maxDays: maxHandling + maxTransit
  };
}

export function normalizeGoogleMerchantOffer({ product, account, searchRequest }) {
  const attributes = getAttributes(product);
  const searchableText = [attributes.title, attributes.description, attributes.brand].filter(Boolean).join(' ');

  if (!textMatchesQuery(searchableText, searchRequest.normalizedQuery)) {
    return undefined;
  }

  const price = choosePrice(attributes, searchRequest.context.currency);
  const shippingResult = chooseShipping(attributes, searchRequest);
  const shipping = shippingResult?.money;
  const taxes = price && shipping && calculateTaxes(attributes, price, shipping, searchRequest);
  const productUrl = attributes.link || attributes.canonicalLink || attributes.mobileLink;
  const sellerName = account.accountName || attributes.externalSellerId;

  if (!price || !shipping || !taxes || !sameCurrency(price, shipping, taxes) || !sellerName || !isHttpsUrl(productUrl)) {
    return undefined;
  }

  return {
    providerName: GOOGLE_MERCHANT_PROVIDER_NAME,
    source: GOOGLE_MERCHANT_SOURCE,
    productTitle: attributes.title,
    productUrl,
    price,
    shipping,
    taxes,
    seller: { name: sellerName },
    delivery: deliveryFromShipping(shippingResult.entry)
  };
}
