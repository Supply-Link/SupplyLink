import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import { invalidatePages, refreshPages } from './events'
import { clearSession, setAuth, setLicense, signIn, signOut } from './authSlice'
import type { AppState } from '../../types'
import type { PagePayloads } from './types'

type State = { data: PagePayloads['pricing'] | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; requestId?: string }
const initialState: State = { data: null, status: 'idle', error: null }

export const loadPricing = createAsyncThunk(
  'pricing/load',
  (_, { signal }) => request<PagePayloads['pricing']>('/pricing', { signal }),
  { condition: (_, { getState }) => (getState() as any).pages.pricing.status !== 'loading' },
)

export const savePricing = createAsyncThunk(
  'pricing/save',
  async (body: { bulk_min: number; bulk_discount_bps: number }, { dispatch, signal }) => {
    const result = await request<AppState['pricing']>('/pricing', { body, signal })
    dispatch(invalidatePages(['pricing', 'catalog', 'activity']))
    return result
  },
)

const pricingSlice = createSlice({
  name: 'pricing',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPricing.pending, (state, action) => { state.status = 'loading'; state.error = null; state.requestId = action.meta.requestId })
      .addCase(loadPricing.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.data = action.payload; state.status = 'ready'; state.requestId = undefined
      })
      .addCase(loadPricing.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'; state.error = action.error.message ?? 'Unable to load this page.'; state.requestId = undefined
      })
      .addCase(invalidatePages, (state, action) => {
        if (action.payload.includes('pricing')) { state.status = 'idle'; state.requestId = undefined; state.error = null }
      })
      .addCase(refreshPages, (state) => { if (state.status === 'ready') state.status = 'idle' })
      .addMatcher(isAnyOf(clearSession, setAuth, signIn.fulfilled, signOut.fulfilled), () => initialState)
      .addMatcher(isAnyOf(setLicense), (state, action) => action.payload.usable ? state : initialState)
  },
})

export default pricingSlice.reducer
