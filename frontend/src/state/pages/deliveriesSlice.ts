import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import { invalidatePages, refreshPages } from './events'
import { clearSession, setAuth, setLicense, signIn, signOut } from './authSlice'
import type { PagePayloads } from './types'

type State = { data: PagePayloads['deliveries'] | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; requestId?: string }
const initialState: State = { data: null, status: 'idle', error: null }

export const loadDeliveries = createAsyncThunk(
  'deliveries/load',
  (_, { signal }) => request<PagePayloads['deliveries']>('/deliveries', { signal }),
  { condition: (_, { getState }) => (getState() as any).pages.deliveries.status !== 'loading' },
)

export const trackDelivery = createAsyncThunk(
  'deliveries/track',
  async (body: { order_id: string; latitude: number; longitude: number }, { dispatch, signal }) => {
    const result = await request<{ latitude: number; longitude: number; at: string }>('/tracking', { body, signal })
    dispatch(invalidatePages(['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell']))
    return result
  },
)

const deliveriesSlice = createSlice({
  name: 'deliveries',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadDeliveries.pending, (state, action) => { state.status = 'loading'; state.error = null; state.requestId = action.meta.requestId })
      .addCase(loadDeliveries.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.data = action.payload; state.status = 'ready'; state.requestId = undefined
      })
      .addCase(loadDeliveries.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'; state.error = action.error.message ?? 'Unable to load this page.'; state.requestId = undefined
      })
      .addCase(invalidatePages, (state, action) => {
        if (action.payload.includes('deliveries')) { state.status = 'idle'; state.requestId = undefined; state.error = null }
      })
      .addCase(refreshPages, (state) => { if (state.status === 'ready') state.status = 'idle' })
      .addMatcher(isAnyOf(clearSession, setAuth, signIn.fulfilled, signOut.fulfilled), () => initialState)
      .addMatcher(isAnyOf(setLicense), (state, action) => action.payload.usable ? state : initialState)
  },
})

export default deliveriesSlice.reducer
