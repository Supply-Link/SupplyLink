import { configureStore } from '@reduxjs/toolkit'
import { describe, expect, it } from 'vitest'
import type { AppState } from '../api/types'
import portal, { loadWorkspace, setLicense } from './portalSlice'

describe('portal business state', () => {
  it('drops the workspace immediately when the licence becomes unusable', () => {
    const store = configureStore({ reducer: portal })
    store.dispatch(loadWorkspace.fulfilled({ orders: [{ id: 'private-order' }] } as AppState, 'request-1', undefined))
    expect(store.getState().workspace?.orders).toHaveLength(1)

    store.dispatch(setLicense({ usable: false, status: 'expired', expires_on: '2026-10-24', expires_at: null }))
    expect(store.getState().workspace).toBeNull()
    expect(store.getState().workspaceStatus).toBe('idle')
  })
})
