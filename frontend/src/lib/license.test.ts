import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { applyLicenseCachePolicy } from './license'

describe('licence cache policy', () => {
  it('clears business data when the licence locks the application', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['state'], { orders: ['sensitive order'] })
    queryClient.setQueryData(['quote', 'medicine-1'], { total: 1200 })
    queryClient.setQueryData(['public-metadata'], { version: 1 })

    applyLicenseCachePolicy(queryClient, {
      usable: false,
      status: 'expired',
      expires_on: '2026-10-23',
      expires_at: '2026-10-23T23:59:59Z',
    })

    expect(queryClient.getQueryData(['state'])).toBeUndefined()
    expect(queryClient.getQueryData(['quote', 'medicine-1'])).toBeUndefined()
    expect(queryClient.getQueryData(['public-metadata'])).toEqual({ version: 1 })
  })

  it('keeps business data available while the licence is usable', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['state'], { orders: ['current order'] })

    applyLicenseCachePolicy(queryClient, {
      usable: true,
      status: 'valid',
      expires_on: '2027-10-23',
      expires_at: '2027-10-23T23:59:59Z',
    })

    expect(queryClient.getQueryData(['state'])).toEqual({ orders: ['current order'] })
  })
})
