export type Cart = Readonly<Record<string, number>>
export type PaymentMethod = 'cod' | 'credit'

export const cartItems = (cart: Cart) =>
  Object.entries(cart).map(([product_id, quantity]) => ({ product_id, quantity }))

export const buildQuoteRequest = (cart: Cart, supplyStateCode: string) => ({
  items: cartItems(cart),
  supply_state_code: supplyStateCode,
})

export const buildOrderRequest = (
  cart: Cart,
  address: string,
  paymentMethod: PaymentMethod,
  supplyStateCode: string,
  expectedTotal: number,
) => ({
  items: cartItems(cart),
  address,
  payment_method: paymentMethod,
  supply_state_code: supplyStateCode,
  expected_total: expectedTotal,
})
