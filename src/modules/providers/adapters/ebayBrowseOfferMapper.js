import { EBAY_BROWSE_SOURCE, EBAY_PROVIDER_NAME } from './ebayBrowseConfig.js';

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseMoney(value) {
  if (!value || typeof value !== 'object' || typeof value.currency !== 'string') {
    return undefined;
  }

  const amount = Number.parseFloat(String(value.value));

  if (!Number.isFinite(amount) || amount < 0) {
    return undefined;
  }

  return {
    amountCents: Math.round(amount * 100),
    currency: value.currency.toUpperCase()
  };
}

function parseTaxPercentage(value) {
  const parsed = Number.parseFloat(String(value || ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function chooseShippingOption(options, currency) {
  if (!Array.isArray(options)) {
    return undefined;
  }

  return options
    .map((option) => ({
      option,
      money: parseMoney(option.shippingCost)
    }))
    .filter((entry) => entry.money && entry.money.currency === currency)
    .sort((left, right) => left.money.amountCents - right.money.amountCents)[0];
}

function daysUntil(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86400000));
}

function extractDelivery(shippingOption) {
  const minDays = daysUntil(shippingOption?.minEstimatedDeliveryDate);
  const maxDays = daysUntil(shippingOption?.maxEstimatedDeliveryDate);

  if (!Number.isInteger(minDays) && !Number.isInteger(maxDays)) {
    return undefined;
  }

  return {
    minDays: Number.isInteger(minDays) ? minDays : maxDays,
    maxDays: Number.isInteger(maxDays) ? maxDays : minDays
  };
}

function calculateTaxAmount(taxes, price, shipping) {
  if (!Array.isArray(taxes)) {
    return undefined;
  }

  const taxEntries = taxes
    .map((tax) => ({
      tax,
      percentage: parseTaxPercentage(tax.taxPercentage)
    }))
    .filter((entry) => entry.percentage !== undefined && entry.tax.includedInPrice !== true);

  if (taxEntries.length === 0) {
    return undefined;
  }

  const amountCents = taxEntries.reduce((sum, entry) => {
    const base = price.amountCents + (entry.tax.shippingAndHandlingTaxed === true ? shipping.amountCents : 0);
    return sum + Math.round(base * (entry.percentage / 100));
  }, 0);

  return {
    amountCents,
    currency: price.currency,
    taxSource: 'ebay.taxes',
    taxPercentages: taxEntries.map((entry) => String(entry.tax.taxPercentage))
  };
}

function getSeller(detail) {
  const seller = detail.seller;

  if (!seller || typeof seller.username !== 'string' || !seller.username.trim()) {
    return undefined;
  }

  const feedbackPercentage = Number.parseFloat(String(seller.feedbackPercentage || ''));

  return {
    name: seller.username,
    reputationScore: Number.isFinite(feedbackPercentage) ? feedbackPercentage / 100 : undefined
  };
}

export function normalizeEbayOffer(detail, searchRequest) {
  const price = parseMoney(detail.price);

  if (!price || price.amountCents <= 0 || price.currency !== searchRequest.context.currency) {
    return undefined;
  }

  const shippingEntry = chooseShippingOption(detail.shippingOptions, price.currency);
  const shipping = shippingEntry?.money;

  if (!shipping) {
    return undefined;
  }

  const taxes = calculateTaxAmount(detail.taxes, price, shipping);
  const seller = getSeller(detail);
  const productUrl = detail.itemAffiliateWebUrl || detail.itemWebUrl;

  if (!taxes || !seller || typeof detail.title !== 'string' || !isHttpsUrl(productUrl)) {
    return undefined;
  }

  return {
    providerName: EBAY_PROVIDER_NAME,
    source: EBAY_BROWSE_SOURCE,
    productTitle: detail.title,
    productUrl,
    price,
    shipping,
    taxes,
    seller,
    delivery: extractDelivery(shippingEntry.option)
  };
}
