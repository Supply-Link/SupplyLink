import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { request } from '../../lib/http'
import type { AuthResponse, LicenseStatus, Role, User } from '../../types'

export const loadLicense = createAsyncThunk('auth/license', (_, { signal }) => request<LicenseStatus>('/api/license', { signal }))
export const loadMe = createAsyncThunk('auth/me', (_, { signal }) => request<AuthResponse>('/api/me', { signal }))
export const signIn = createAsyncThunk('auth/login', (body: { email: string; password: string }, { signal }) => request<AuthResponse>('/api/login', { body, signal }))
export const signOut = createAsyncThunk('auth/logout', (_, { signal }) => request<{ ok: boolean }>('/api/logout', { body: {}, signal }))
export const registerAccount = createAsyncThunk('auth/register', (body: Record<string, string>, { signal }) => request<{ ok: boolean; message: string }>('/api/register', { body, signal }))
interface AuthState {
  user: User | null
  navigationRole: Role | null
  license: LicenseStatus | null
  error: string | null
}

const initialState: AuthState = { user: null, navigationRole: null, license: null, error: null }

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<AuthResponse>) { state.user = action.payload.user; state.navigationRole = action.payload.user.role; state.license = action.payload.license },
    setLicense(state, action: PayloadAction<LicenseStatus>) { state.license = action.payload },
    clearSession(state) { state.user = null; state.navigationRole = null; state.error = null },
  },
  extraReducers: (builder) => {
    builder.addCase(loadLicense.fulfilled, (state, action) => { state.license = action.payload })
    builder.addCase(loadMe.fulfilled, (state, action) => { state.user = action.payload.user; state.navigationRole = action.payload.user.role; state.license = action.payload.license })
    builder.addCase(signIn.fulfilled, (state, action) => { state.user = action.payload.user; state.navigationRole = action.payload.user.role; state.license = action.payload.license })
    builder.addCase(signOut.fulfilled, (state) => { state.user = null; state.navigationRole = null })
  },
})

export const { setAuth, setLicense, clearSession } = authSlice.actions
export default authSlice.reducer
