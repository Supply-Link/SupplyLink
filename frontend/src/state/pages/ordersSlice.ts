import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import { invalidatePages, refreshPages } from './events'
import { clearSession, setAuth, setLicense, signIn, signOut } from './authSlice'
import type { Order, OrderStatus, ReturnRequest } from '../../types'
import type { PagePayloads } from './types'

type State = { data: PagePayloads['orders'] | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; requestId?: string }
const initialState: State = { data: null, status: 'idle', error: null }

export const loadOrders = createAsyncThunk(
  'orders/load',
  (_, { signal }) => request<PagePayloads['orders']>('/orders', { signal }),
  { condition: (_, { getState }) => (getState() as any).pages.orders.status !== 'loading' },
)

export const createOrder = createAsyncThunk(
  'orders/create',
  async (
    { body, key }: { body: { items: Array<{ product_id: string; quantity: number }>; address: string; payment_method: 'cod' | 'credit'; supply_state_code: string; expected_total: number }; key: string },
    { dispatch, signal },
  ) => {
    const result = await request<Order>('/orders', { body, idempotencyKey: key, signal })
    dispatch(invalidatePages(['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell']))
    return result
  },
)

export const updateOrder = createAsyncThunk(
  'orders/update',
  async ({ id, body }: { id: string; body: { status: OrderStatus; driver_id?: string } }, { dispatch, signal }) => {
    const result = await request<Order>(`/orders/${encodeURIComponent(id)}`, { body, signal })
    dispatch(invalidatePages(['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell']))
    return result
  },
)

export const reviewReturn = createAsyncThunk(
  'orders/reviewReturn',
  async (body: { order_id: string; action: 'approve' | 'reject'; review_note: string }, { dispatch, signal }) => {
    const result = await request<ReturnRequest>('/returns', { body, signal })
    dispatch(invalidatePages(['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell']))
    return result
  },
)

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadOrders.pending, (state, action) => { state.status = 'loading'; state.error = null; state.requestId = action.meta.requestId })
      .addCase(loadOrders.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.data = action.payload; state.status = 'ready'; state.requestId = undefined
      })
      .addCase(loadOrders.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'; state.error = action.error.message ?? 'Unable to load this page.'; state.requestId = undefined
      })
      .addCase(invalidatePages, (state, action) => {
        if (action.payload.includes('orders')) { state.status = 'idle'; state.requestId = undefined; state.error = null }
      })
      .addCase(refreshPages, (state) => { if (state.status === 'ready') state.status = 'idle' })
      .addMatcher(isAnyOf(clearSession, setAuth, signIn.fulfilled, signOut.fulfilled), () => initialState)
      .addMatcher(isAnyOf(setLicense), (state, action) => action.payload.usable ? state : initialState)
  },
})

export default ordersSlice.reducer
