import { savePricing } from './pages/pricingSlice'
import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it, vi, afterEach } from 'vitest'
import type { PagePayloads } from './pages/types'
import type { User } from '../types'
import auth, { clearSession, setLicense } from './pages/authSlice'
import { pagesReducer, pageLoaders } from './pages'
import { invalidatePages } from './pages/events'

const user = { id: 'admin', role: 'admin', name: 'Admin' } as User
const orders: PagePayloads['orders'] = { user, users: [], orders: [] }
const pricing: PagePayloads['pricing'] = { user, pricing: { bulk_min: 10, bulk_discount_bps: 100 } }
const makeStore = () => configureStore({ reducer: { auth, pages: pagesReducer } })
afterEach(() => vi.unstubAllGlobals())

describe('independent page caches', () => {
  it('calls the specific page API and deduplicates concurrent requests', async () => {
    let resolve!: (response: Response) => void
    const fetch = vi.fn((_url: RequestInfo | URL) => new Promise<Response>((done) => { resolve = done }))
    vi.stubGlobal('fetch', fetch)
    const store = makeStore()
    const first = store.dispatch(pageLoaders.orders())
    await store.dispatch(pageLoaders.orders())
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/orders$/)
    resolve(new Response(JSON.stringify(orders), { status: 200 }))
    await first
    expect(store.getState().pages.orders.data).toEqual(orders)
    expect(store.getState().pages.pricing.data).toBeNull()
  })

  it('invalidates affected pages without throwing away visible data or unrelated caches', () => {
    const store = makeStore()
    store.dispatch(pageLoaders.orders.pending('orders-1', undefined))
    store.dispatch(pageLoaders.orders.fulfilled(orders, 'orders-1', undefined))
    store.dispatch(pageLoaders.pricing.pending('pricing-1', undefined))
    store.dispatch(pageLoaders.pricing.fulfilled(pricing, 'pricing-1', undefined))
    store.dispatch(invalidatePages(['orders']))
    expect(store.getState().pages.orders.status).toBe('idle')
    expect(store.getState().pages.orders.data).toEqual(orders)
    expect(store.getState().pages.pricing.status).toBe('ready')
  })

  it.each(['logout', 'licence'])('clears every page on %s and rejects late private responses', (reason) => {
    const store = makeStore()
    store.dispatch(pageLoaders.orders.pending('old-session', undefined))
    store.dispatch(pageLoaders.pricing.pending('pricing-1', undefined))
    store.dispatch(pageLoaders.pricing.fulfilled(pricing, 'pricing-1', undefined))
    store.dispatch(reason === 'logout' ? clearSession() : setLicense({ usable: false, status: 'expired', expires_on: null, expires_at: null }))
    store.dispatch(pageLoaders.orders.fulfilled(orders, 'old-session', undefined))
    for (const page of Object.values(store.getState().pages)) expect(page.data).toBeNull()
  })

  it('ignores a response invalidated by a newer mutation', () => {
    const store = makeStore()
    store.dispatch(pageLoaders.orders.pending('before-save', undefined))
    store.dispatch(invalidatePages(['orders']))
    store.dispatch(pageLoaders.orders.pending('after-save', undefined))
    store.dispatch(pageLoaders.orders.fulfilled(orders, 'before-save', undefined))
    expect(store.getState().pages.orders.data).toBeNull()
    store.dispatch(pageLoaders.orders.fulfilled(orders, 'after-save', undefined))
    expect(store.getState().pages.orders.status).toBe('ready')
  })
})


describe('direct slice mutations', () => {
  it('refreshes dependent page caches in the store that dispatched the save', async () => {
    const store = makeStore()
    const otherStore = makeStore()
    for (const target of [store, otherStore]) {
      target.dispatch(pageLoaders.pricing.pending('pricing-ready', undefined))
      target.dispatch(pageLoaders.pricing.fulfilled(pricing, 'pricing-ready', undefined))
      target.dispatch(pageLoaders.orders.pending('orders-ready', undefined))
      target.dispatch(pageLoaders.orders.fulfilled(orders, 'orders-ready', undefined))
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(pricing.pricing), { status: 200 })))
    await expect(store.dispatch(savePricing(pricing.pricing)).unwrap()).resolves.toEqual(pricing.pricing)
    expect(store.getState().pages.pricing.status).toBe('idle')
    expect(store.getState().pages.orders.status).toBe('ready')
    expect(otherStore.getState().pages.pricing.status).toBe('ready')
  })

  it('preserves ready page data when a directly dispatched save fails', async () => {
    const store = makeStore()
    store.dispatch(pageLoaders.pricing.pending('pricing-ready', undefined))
    store.dispatch(pageLoaders.pricing.fulfilled(pricing, 'pricing-ready', undefined))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid pricing' }), { status: 400 })))
    await expect(store.dispatch(savePricing(pricing.pricing)).unwrap()).rejects.toMatchObject({ message: 'Invalid pricing' })
    expect(store.getState().pages.pricing.status).toBe('ready')
    expect(store.getState().pages.pricing.data).toEqual(pricing)
  })
})
