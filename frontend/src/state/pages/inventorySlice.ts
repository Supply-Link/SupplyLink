import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import { invalidatePages, refreshPages } from './events'
import { clearSession, setAuth, setLicense, signIn, signOut } from './authSlice'
import type { Batch, BatchInput, Product, ProductInput } from '../../types'
import type { PagePayloads } from './types'

type State = { data: PagePayloads['inventory'] | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; requestId?: string }
const initialState: State = { data: null, status: 'idle', error: null }

export const loadInventory = createAsyncThunk(
  'inventory/load',
  (_, { signal }) => request<PagePayloads['inventory']>('/inventory', { signal }),
  { condition: (_, { getState }) => (getState() as any).pages.inventory.status !== 'loading' },
)

export const saveProduct = createAsyncThunk(
  'inventory/saveProduct',
  async (body: ProductInput, { dispatch, signal }) => {
    const result = await request<Product>('/products', { body, signal })
    dispatch(invalidatePages(['inventory', 'catalog', 'dashboard', 'activity']))
    return result
  },
)

export const receiveBatch = createAsyncThunk(
  'inventory/receiveBatch',
  async (body: BatchInput, { dispatch, signal }) => {
    const result = await request<Batch>('/batches', { body, signal })
    dispatch(invalidatePages(['inventory', 'catalog', 'dashboard', 'activity']))
    return result
  },
)

export const adjustStock = createAsyncThunk(
  'inventory/adjustStock',
  async (body: { product_id: string; batch_id: string; change: number; reason: string }, { dispatch, signal }) => {
    const result = await request<Batch>('/inventory', { body, signal })
    dispatch(invalidatePages(['inventory', 'catalog', 'dashboard', 'activity']))
    return result
  },
)

export const setBatchQuarantine = createAsyncThunk(
  'inventory/setBatchQuarantine',
  async (body: { product_id: string; batch_id: string; quarantined: boolean; reason: string }, { dispatch, signal }) => {
    const result = await request<Batch>('/batches/quarantine', { body, signal })
    dispatch(invalidatePages(['inventory', 'catalog', 'dashboard', 'activity']))
    return result
  },
)

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadInventory.pending, (state, action) => { state.status = 'loading'; state.error = null; state.requestId = action.meta.requestId })
      .addCase(loadInventory.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.data = action.payload; state.status = 'ready'; state.requestId = undefined
      })
      .addCase(loadInventory.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'; state.error = action.error.message ?? 'Unable to load this page.'; state.requestId = undefined
      })
      .addCase(invalidatePages, (state, action) => {
        if (action.payload.includes('inventory')) { state.status = 'idle'; state.requestId = undefined; state.error = null }
      })
      .addCase(refreshPages, (state) => { if (state.status === 'ready') state.status = 'idle' })
      .addMatcher(isAnyOf(clearSession, setAuth, signIn.fulfilled, signOut.fulfilled), () => initialState)
      .addMatcher(isAnyOf(setLicense), (state, action) => action.payload.usable ? state : initialState)
  },
})

export default inventorySlice.reducer
