import { describe, expect, it } from 'vitest'
import { canAccess, date, label, money } from './helpers'

describe('display and permission helpers', () => {
  it('formats stored paise, dates, and machine labels for people', () => {
    expect(money(123456)).toBe('₹1,234.56')
    expect(date('2026-10-24T12:00:00.000Z')).toBe('24 Oct 2026')
    expect(label('out_for_delivery')).toBe('Out For Delivery')
  })

  it('allows only roles configured for a route', () => {
    expect(canAccess('retailer', 'catalog')).toBe(true)
    expect(canAccess('delivery', 'catalog')).toBe(false)
    expect(canAccess('admin', 'unknown')).toBe(false)
  })
})
