export const PRODUCT_QUERY = `query SearchForPayProducts($first: Int!, $query: String!) {
  shop { name }
  products(first: $first, query: $query) {
    edges {
      node {
        title
        onlineStoreUrl
        variants(first: 10) {
          edges {
            node {
              id
              availableForSale
              price { amount currencyCode }
            }
          }
        }
      }
    }
  }
}`;

export const CART_MUTATION = `mutation SearchForPayCart($input: CartInput) {
  cartCreate(input: $input) {
    cart {
      checkoutUrl
      cost {
        subtotalAmount { amount currencyCode }
        totalTaxAmount { amount currencyCode }
      }
      deliveryGroups(first: 10) {
        edges {
          node {
            deliveryOptions {
              title
              estimatedCost { amount currencyCode }
            }
          }
        }
      }
    }
    userErrors { field message }
  }
}`;
