import { describe, expect, it } from 'vitest'
import { buildOrderRequest, buildQuoteRequest } from './checkout'

describe('checkout request builders', () => {
  const cart = { 'medicine-1': 2, 'medicine-2': 1 }

  it('builds the server quote request from cart quantities and supply state', () => {
    expect(buildQuoteRequest(cart, '29')).toEqual({
      items: [
        { product_id: 'medicine-1', quantity: 2 },
        { product_id: 'medicine-2', quantity: 1 },
      ],
      supply_state_code: '29',
    })
  })

  it('carries the accepted quote total into the final order request', () => {
    expect(buildOrderRequest(cart, '12 Market Road', 'credit', '27', 184250)).toEqual({
      items: [
        { product_id: 'medicine-1', quantity: 2 },
        { product_id: 'medicine-2', quantity: 1 },
      ],
      address: '12 Market Road',
      payment_method: 'credit',
      supply_state_code: '27',
      expected_total: 184250,
    })
  })
})
