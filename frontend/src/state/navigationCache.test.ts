import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthResponse } from '../types'
import { clearSession, loadMe, signIn, signOut } from './pages/authSlice'
import { createAppStore } from './store'
import { readNavigationRole } from './navigationCache'

const response = (role: AuthResponse['user']['role']) => ({
  user: { id: 'test', name: 'Test User', role, business: 'Test Business' },
  csrf: 'must-not-be-persisted',
  license: { usable: true, status: 'active', expires_on: null, expires_at: null },
} as AuthResponse)

beforeEach(() => sessionStorage.clear())
afterEach(() => { vi.restoreAllMocks(); sessionStorage.clear() })

describe('navigation persistence', () => {
  it.each(['admin', 'distributor', 'retailer', 'delivery'] as const)('restores %s navigation on refresh without restoring authentication', (role) => {
    const store = createAppStore()
    store.dispatch(signIn.fulfilled(response(role), 'login', { email: 'test@example.com', password: 'test' }))
    const refreshed = createAppStore().getState()
    expect(refreshed.auth.navigationRole).toBe(role)
    expect(refreshed.auth.user).toBeNull()
    expect(refreshed.auth.license).toBeNull()
    expect(Object.values(refreshed.pages).every((page) => page.data === null)).toBe(true)
    expect(sessionStorage.length).toBe(1)
    expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe(role)
  })

  it('replaces the cached role with the server-verified role', () => {
    const store = createAppStore()
    store.dispatch(loadMe.pending('me-1', undefined))
    store.dispatch(loadMe.fulfilled(response('admin'), 'me-1', undefined))
    store.dispatch(loadMe.pending('me-2', undefined))
    store.dispatch(loadMe.fulfilled(response('retailer'), 'me-2', undefined))
    expect(readNavigationRole()).toBe('retailer')
  })

  it.each(['logout', 'expired-session'])('removes cached navigation after %s', (reason) => {
    const store = createAppStore()
    store.dispatch(loadMe.pending('me-1', undefined))
    store.dispatch(loadMe.fulfilled(response('admin'), 'me-1', undefined))
    store.dispatch(reason === 'logout' ? signOut.fulfilled({ ok: true }, 'logout', undefined) : clearSession())
    expect(readNavigationRole()).toBeNull()
    expect(createAppStore().getState().auth.navigationRole).toBeNull()
  })

  it('ignores malformed cached roles', () => {
    sessionStorage.setItem('supplylink.navigation-role', 'unknown-role')
    expect(createAppStore().getState().auth.navigationRole).toBeNull()
  })

  it('still signs in when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    const store = createAppStore()
    store.dispatch(loadMe.pending('me-1', undefined))
    store.dispatch(loadMe.fulfilled(response('admin'), 'me-1', undefined))
    expect(store.getState().auth.user?.role).toBe('admin')
  })
})
