import { createAsyncThunk, createSlice, isAnyOf } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import { invalidatePages, refreshPages } from './events'
import { clearSession, setAuth, setLicense, signIn, signOut } from './authSlice'
import type { NewUserInput, Role, User } from '../../types'
import type { PagePayloads } from './types'

type State = { data: PagePayloads['people'] | null; status: 'idle' | 'loading' | 'ready' | 'error'; error: string | null; requestId?: string }
const initialState: State = { data: null, status: 'idle', error: null }

const allPages = ['people', 'directory', 'credit', 'business', 'inventory', 'orders', 'deliveries', 'payments', 'dashboard', 'activity', 'notifications', 'shell'] as const

export const loadPeople = createAsyncThunk(
  'people/load',
  (_, { signal }) => request<PagePayloads['people']>('/people', { signal }),
  { condition: (_, { getState }) => (getState() as any).pages.people.status !== 'loading' },
)

export const updateUser = createAsyncThunk(
  'people/updateUser',
  async (body: { id: string; credit_limit?: number; active?: boolean }, { dispatch, signal }) => {
    const result = await request<User>('/users', { body, signal })
    dispatch(invalidatePages([...allPages]))
    return result
  },
)

export const createUser = createAsyncThunk(
  'people/createUser',
  async (body: NewUserInput, { dispatch, signal }) => {
    const result = await request<User>('/users', { body, signal })
    dispatch(invalidatePages([...allPages]))
    return result
  },
)

export const approveRegistration = createAsyncThunk(
  'people/approveRegistration',
  async (body: { user_id: string; role: Role }, { dispatch, signal }) => {
    const result = await request<User>('/registrations/approve', { body, signal })
    dispatch(invalidatePages([...allPages]))
    return result
  },
)

export const rejectRegistration = createAsyncThunk(
  'people/rejectRegistration',
  async (body: { user_id: string; reason: string }, { dispatch, signal }) => {
    const result = await request<User>('/registrations/reject', { body, signal })
    dispatch(invalidatePages([...allPages]))
    return result
  },
)

const peopleSlice = createSlice({
  name: 'people',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPeople.pending, (state, action) => { state.status = 'loading'; state.error = null; state.requestId = action.meta.requestId })
      .addCase(loadPeople.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.data = action.payload; state.status = 'ready'; state.requestId = undefined
      })
      .addCase(loadPeople.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return
        state.status = 'error'; state.error = action.error.message ?? 'Unable to load this page.'; state.requestId = undefined
      })
      .addCase(invalidatePages, (state, action) => {
        if (action.payload.includes('people')) { state.status = 'idle'; state.requestId = undefined; state.error = null }
      })
      .addCase(refreshPages, (state) => { if (state.status === 'ready') state.status = 'idle' })
      .addMatcher(isAnyOf(clearSession, setAuth, signIn.fulfilled, signOut.fulfilled), () => initialState)
      .addMatcher(isAnyOf(setLicense), (state, action) => action.payload.usable ? state : initialState)
  },
})

export default peopleSlice.reducer
