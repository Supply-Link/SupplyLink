import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { api as endpoints } from '../api/endpoints'
import type { AppState, AuthResponse, LicenseStatus, Quote, User } from '../api/types'

export const loadLicense = createAsyncThunk('portal/license', endpoints.license)
export const loadMe = createAsyncThunk('portal/me', endpoints.me)
export const signIn = createAsyncThunk('portal/login', async (body: { email: string; password: string }) => endpoints.login(body))
export const signOut = createAsyncThunk('portal/logout', endpoints.logout)
export const registerAccount = createAsyncThunk('portal/register', async (body: Record<string, string>) => endpoints.register(body))
export const loadWorkspace = createAsyncThunk('portal/workspace', endpoints.state)
export const loadQuote = createAsyncThunk('portal/quote', async (body: Parameters<typeof endpoints.quote>[0]) => endpoints.quote(body))

// Controllers dispatch these commands; the endpoint module remains the only HTTP adapter.
export const createOrder = createAsyncThunk('portal/createOrder', async (args: { body: Parameters<typeof endpoints.createOrder>[0]; key: string }) => endpoints.createOrder(args.body, args.key))
export const updateOrder = createAsyncThunk('portal/updateOrder', async (args: { id: string; body: Parameters<typeof endpoints.updateOrder>[1] }) => endpoints.updateOrder(args.id, args.body))
export const recordPayment = createAsyncThunk('portal/recordPayment', async (args: { body: Parameters<typeof endpoints.recordPayment>[0]; key: string }) => endpoints.recordPayment(args.body, args.key))
export const trackDelivery = createAsyncThunk('portal/track', async (body: Parameters<typeof endpoints.track>[0]) => endpoints.track(body))
export const reviewReturn = createAsyncThunk('portal/reviewReturn', async (body: Parameters<typeof endpoints.reviewReturn>[0]) => endpoints.reviewReturn(body))
export const updateUser = createAsyncThunk('portal/updateUser', async (body: Parameters<typeof endpoints.updateUser>[0]) => endpoints.updateUser(body))
export const createUser = createAsyncThunk('portal/createUser', async (body: Parameters<typeof endpoints.createUser>[0]) => endpoints.createUser(body))
export const approveRegistration = createAsyncThunk('portal/approveRegistration', async (body: Parameters<typeof endpoints.approveRegistration>[0]) => endpoints.approveRegistration(body))
export const rejectRegistration = createAsyncThunk('portal/rejectRegistration', async (body: Parameters<typeof endpoints.rejectRegistration>[0]) => endpoints.rejectRegistration(body))
export const saveProduct = createAsyncThunk('portal/saveProduct', async (body: Parameters<typeof endpoints.saveProduct>[0]) => endpoints.saveProduct(body))
export const receiveBatch = createAsyncThunk('portal/receiveBatch', async (body: Parameters<typeof endpoints.receiveBatch>[0]) => endpoints.receiveBatch(body))
export const adjustStock = createAsyncThunk('portal/adjustStock', async (body: Parameters<typeof endpoints.adjustStock>[0]) => endpoints.adjustStock(body))
export const setBatchQuarantine = createAsyncThunk('portal/setBatchQuarantine', async (body: Parameters<typeof endpoints.setBatchQuarantine>[0]) => endpoints.setBatchQuarantine(body))
export const savePricing = createAsyncThunk('portal/savePricing', async (body: Parameters<typeof endpoints.savePricing>[0]) => endpoints.savePricing(body))
export const saveBusiness = createAsyncThunk('portal/saveBusiness', async (body: Parameters<typeof endpoints.saveBusiness>[0]) => endpoints.saveBusiness(body))
export const readNotifications = createAsyncThunk('portal/readNotifications', endpoints.readNotifications)

interface PortalState {
  user: User | null
  license: LicenseStatus | null
  workspace: AppState | null
  quote: Quote | null
  workspaceStatus: 'idle' | 'loading' | 'ready' | 'error'
  quoteStatus: 'idle' | 'loading' | 'ready' | 'error'
  error: string | null
}

const initialState: PortalState = { user: null, license: null, workspace: null, quote: null, workspaceStatus: 'idle', quoteStatus: 'idle', error: null }

const portalSlice = createSlice({
  name: 'portal',
  initialState,
  reducers: {
    setAuth(state, action: PayloadAction<AuthResponse>) { state.user = action.payload.user; state.license = action.payload.license },
    setLicense(state, action: PayloadAction<LicenseStatus>) { state.license = action.payload; if (!action.payload.usable) { state.workspace = null; state.quote = null; state.workspaceStatus = 'idle' } },
    clearSession(state) { state.user = null; state.workspace = null; state.quote = null; state.workspaceStatus = 'idle'; state.quoteStatus = 'idle'; state.error = null },
  },
  extraReducers: (builder) => {
    builder.addCase(loadLicense.fulfilled, (state, action) => { state.license = action.payload; if (!action.payload.usable) { state.workspace = null; state.quote = null } })
    builder.addCase(loadMe.fulfilled, (state, action) => { state.user = action.payload.user; state.license = action.payload.license })
    builder.addCase(signIn.fulfilled, (state, action) => { state.user = action.payload.user; state.license = action.payload.license; state.workspace = null })
    builder.addCase(signOut.fulfilled, (state) => { state.user = null; state.workspace = null; state.quote = null })
    builder.addCase(loadWorkspace.pending, (state) => { state.workspaceStatus = 'loading'; state.error = null })
    builder.addCase(loadWorkspace.fulfilled, (state, action) => { state.workspaceStatus = 'ready'; state.workspace = action.payload })
    builder.addCase(loadWorkspace.rejected, (state, action) => { state.workspaceStatus = 'error'; state.error = action.error.message ?? 'Workspace is unavailable.' })
    builder.addCase(loadQuote.pending, (state) => { state.quoteStatus = 'loading'; state.quote = null })
    builder.addCase(loadQuote.fulfilled, (state, action) => { state.quoteStatus = 'ready'; state.quote = action.payload })
    builder.addCase(loadQuote.rejected, (state) => { state.quoteStatus = 'error'; state.quote = null })
  },
})

export const { setAuth, setLicense, clearSession } = portalSlice.actions
export default portalSlice.reducer
