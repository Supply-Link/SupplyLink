import { request } from './client'
import type {
  AppState, AuthResponse, Batch, BatchInput, BusinessInput, LicenseStatus, NewUserInput,
  Order, OrderStatus, Payment, Product, ProductInput, Quote, ReturnRequest, Role, User,
} from './types'

export const api = {
  license: () => request<LicenseStatus>('/api/license'),
  me: () => request<AuthResponse>('/api/me'),
  state: () => request<AppState>('/api/state'),
  login: (body: { email: string; password: string }) => request<AuthResponse>('/api/login', { body }),
  logout: () => request<{ ok: boolean }>('/api/logout', { body: {} }),
  register: (body: Record<string, string>) => request<{ ok: boolean; message: string }>('/api/register', { body }),
  quote: (body: { items: Array<{ product_id: string; quantity: number }>; supply_state_code: string }) =>
    request<Quote>('/api/quote', { body }),
  createOrder: (
    body: {
      items: Array<{ product_id: string; quantity: number }>
      address: string
      payment_method: 'cod' | 'credit'
      supply_state_code: string
      expected_total: number
    },
    idempotencyKey: string,
  ) => request<Order>('/api/orders', { body, idempotencyKey }),
  updateOrder: (id: string, body: { status: OrderStatus; driver_id?: string }) =>
    request<Order>(`/api/orders/${encodeURIComponent(id)}`, { body }),
  recordPayment: (body: { order_id: string; amount: number; reference: string }, idempotencyKey: string) =>
    request<Payment>('/api/payments', { body, idempotencyKey }),
  track: (body: { order_id: string; latitude: number; longitude: number }) =>
    request<{ latitude: number; longitude: number; at: string }>('/api/tracking', { body }),
  reviewReturn: (body: { order_id: string; action: 'approve' | 'reject'; review_note: string }) =>
    request<ReturnRequest>('/api/returns', { body }),
  updateUser: (body: { id: string; credit_limit?: number; active?: boolean }) =>
    request<User>('/api/users', { body }),
  createUser: (body: NewUserInput) => request<User>('/api/users', { body }),
  approveRegistration: (body: { user_id: string; role: Role }) =>
    request<User>('/api/registrations/approve', { body }),
  rejectRegistration: (body: { user_id: string; reason: string }) =>
    request<User>('/api/registrations/reject', { body }),
  saveProduct: (body: ProductInput) => request<Product>('/api/products', { body }),
  receiveBatch: (body: BatchInput) => request<Batch>('/api/batches', { body }),
  adjustStock: (body: { product_id: string; batch_id: string; change: number; reason: string }) =>
    request<Batch>('/api/inventory', { body }),
  setBatchQuarantine: (body: {
    product_id: string
    batch_id: string
    quarantined: boolean
    reason: string
  }) => request<Batch>('/api/batches/quarantine', { body }),
  savePricing: (body: { bulk_min: number; bulk_discount_bps: number }) =>
    request<AppState['pricing']>('/api/pricing', { body }),
  saveBusiness: (body: BusinessInput) =>
    request<Pick<User, 'id' | 'business' | 'legal_name' | 'address' | 'gstin' | 'state_code' | 'drug_license'>>(
      '/api/business',
      { body },
    ),
  readNotifications: () => request<{ ok: boolean }>('/api/notifications/read', { body: {} }),
}
