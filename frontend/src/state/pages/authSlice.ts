import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import type { AuthResponse, LicenseStatus, Role, User } from '../../types'

export const loadMe = createAsyncThunk(
  'auth/me',
  (_, { signal }) => request<AuthResponse>('/me', { signal }),
  { condition: (_, { getState }) => (getState() as any).auth.status !== 'loading' },
)
export const signIn = createAsyncThunk('auth/login', (body: { email: string; password: string }, { signal }) => request<AuthResponse>('/login', { body, signal }))
export const signOut = createAsyncThunk('auth/logout', (_, { signal }) => request<{ ok: boolean }>('/logout', { body: {}, signal }))
export const registerAccount = createAsyncThunk('auth/register', (body: Record<string, string>, { signal }) => request<{ ok: boolean; message: string }>('/register', { body, signal }))
interface AuthState {
  user: User | null
  navigationRole: Role | null
  license: LicenseStatus | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
  requestId?: string
}

const initialState: AuthState = { user: null, navigationRole: null, license: null, status: 'idle', error: null }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<AuthResponse>) { state.user = action.payload.user; state.navigationRole = action.payload.user.role; state.license = action.payload.license },
    setLicense(state, action: PayloadAction<LicenseStatus>) { state.license = action.payload },
    clearSession(state) { state.user = null; state.navigationRole = null; state.error = null },
  },
  extraReducers: (builder) => {
    builder.addCase(loadMe.pending, (state, action) => { state.status = 'loading'; state.requestId = action.meta.requestId })
    builder.addCase(loadMe.fulfilled, (state, action) => {
      if (state.requestId !== action.meta.requestId) return
      state.status = 'ready'; state.user = action.payload.user; state.navigationRole = action.payload.user.role; state.license = action.payload.license
    })
    builder.addCase(loadMe.rejected, (state, action) => { state.status = 'error'; state.error = action.error.message ?? 'Unknown error' })
    builder.addCase(signIn.fulfilled, (state, action) => { state.user = action.payload.user; state.navigationRole = action.payload.user.role; state.license = action.payload.license })
    builder.addCase(signOut.fulfilled, (state) => { state.user = null; state.navigationRole = null })
  },
})

export const { setAuth, setLicense, clearSession } = authSlice.actions
export default authSlice.reducer
