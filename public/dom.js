export function el(tag, className, text) {
  const node = document.createElement(tag);

  if (className) {
    node.className = className;
  }

  if (text !== undefined) {
    node.textContent = text;
  }

  return node;
}

export function formatMoney(value) {
  if (!value?.currency || !Number.isInteger(value.amountCents)) {
    return 'Nao informado';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: value.currency
  }).format(value.amountCents / 100);
}
