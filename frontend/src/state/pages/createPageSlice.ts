import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import type { PageName, PagePayloads } from './types'
import { clearSession, setAuth, setLicense, loadLicense, signIn, signOut } from './authSlice'
import { invalidatePages, refreshPages } from './events'

export interface PageState {
  data: PagePayloads[PageName] | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  requestId?: string
}
const initialState: PageState = { data: null, status: 'idle', error: null }

export function createPageSlice<P extends PageName>(name: P, fetchPage: (signal?: AbortSignal) => Promise<PagePayloads[P]>) {
  const load = createAsyncThunk<PagePayloads[PageName]>(`pages/${name}/load`, (_, { signal }) => fetchPage(signal), {
    condition: (_, { getState }) => (getState() as { pages: Record<PageName, PageState> }).pages[name].status !== 'loading',
  })
  const slice = createSlice({
    name, initialState,
    reducers: {},
    extraReducers: (builder) => {
      builder.addCase(load.pending, (state, action) => {
        state.status = 'loading'; state.error = null; state.requestId = action.meta.requestId
      })
      builder.addCase(load.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.data = action.payload; state.status = 'ready'; state.requestId = undefined
      })
      builder.addCase(load.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'; state.error = action.error.message ?? 'Unable to load this page.'; state.requestId = undefined
      })
      builder.addCase(invalidatePages, (state, action) => {
        if (action.payload.includes(name)) { state.status = 'idle'; state.requestId = undefined; state.error = null }
      })
      builder.addCase(refreshPages, (state) => {
        // Polling must not supersede a slow in-flight request.
        if (state.status === 'ready') state.status = 'idle'
      })
      // Ignore late responses from a previous session or before a licence lock.
      builder.addMatcher(isAnyOf(clearSession, setAuth, signIn.fulfilled, signOut.fulfilled), () => initialState)
      builder.addMatcher(isAnyOf(setLicense, loadLicense.fulfilled), (state, action) => action.payload.usable ? state : initialState)
    },
  })
  return { load, reducer: slice.reducer }
}
