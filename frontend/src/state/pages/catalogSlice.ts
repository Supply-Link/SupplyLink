import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import { invalidatePages, refreshPages } from './events'
import { clearSession, setAuth, setLicense, signIn, signOut } from './authSlice'
import type { Quote } from '../../types'
import type { PagePayloads } from './types'

type State = { data: PagePayloads['catalog'] | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; requestId?: string }
const initialState: State = { data: null, status: 'idle', error: null }

export const loadCatalog = createAsyncThunk(
  'catalog/load',
  (_, { signal }) => request<PagePayloads['catalog']>('/catalog', { signal }),
  { condition: (_, { getState }) => (getState() as any).pages.catalog.status !== 'loading' },
)

export const loadQuote = createAsyncThunk(
  'catalog/loadQuote',
  (body: { items: Array<{ product_id: string; quantity: number }>; supply_state_code: string }, { signal }) =>
    request<Quote>('/quote', { body, signal }),
)

const catalogSlice = createSlice({
  name: 'catalog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCatalog.pending, (state, action) => { state.status = 'loading'; state.error = null; state.requestId = action.meta.requestId })
      .addCase(loadCatalog.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.data = action.payload; state.status = 'ready'; state.requestId = undefined
      })
      .addCase(loadCatalog.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'; state.error = action.error.message ?? 'Unable to load this page.'; state.requestId = undefined
      })
      .addCase(invalidatePages, (state, action) => {
        if (action.payload.includes('catalog')) { state.status = 'idle'; state.requestId = undefined; state.error = null }
      })
      .addCase(refreshPages, (state) => { if (state.status === 'ready') state.status = 'idle' })
      .addMatcher(isAnyOf(clearSession, setAuth, signIn.fulfilled, signOut.fulfilled), () => initialState)
      .addMatcher(isAnyOf(setLicense), (state, action) => action.payload.usable ? state : initialState)
  },
})

export default catalogSlice.reducer
