export type Role = 'admin' | 'distributor' | 'retailer' | 'delivery'
export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
export type PaymentStatus = 'paid' | 'unpaid'

export interface LicenseStatus {
  usable: boolean
  status: 'valid' | 'expired' | 'missing' | 'invalid' | 'unavailable' | string
  expires_on: string | null
  expires_at: string | null
  server_time?: string
}

export interface User {
  id: string
  name: string
  business: string
  role: Role
  email?: string
  active?: boolean
  approval_status?: 'pending' | 'approved' | 'rejected'
  requested_role?: Role
  address?: string
  legal_name?: string
  gstin?: string
  state_code?: string
  drug_license?: string
  credit_limit?: number
  credit_used?: number
}

export interface Batch {
  id: string
  batch_number: string
  manufacturing_date: string
  expiry_date: string
  stock: number
  mrp: number
  purchase_price?: number
  quarantined: boolean
  status: 'available' | 'near_expiry' | 'expired' | 'quarantined' | 'exhausted'
  demo?: boolean
}

export interface Product {
  id: string
  name: string
  brand: string
  generic_name?: string
  strength?: string
  dosage_form?: string
  category: string
  sku: string
  unit: string
  price: number
  stock: number
  reorder: number
  art: string
  color: string
  distributor_id: string
  active: boolean
  manufacturer?: string
  storage_conditions?: string
  hsn_code?: string
  gst_rate_bps?: number
  batches?: Batch[]
  unallocated_stock?: number
  near_expiry_stock?: number
  expired_stock?: number
  quarantined_stock?: number
  next_expiry?: string
  demo?: boolean
}

export interface Allocation {
  batch_id: string
  batch_number: string
  manufacturing_date: string
  expiry_date: string
  mrp: number
  quantity: number
}

export interface OrderLine {
  product_id: string
  name: string
  unit: string
  quantity: number
  unit_price: number
  subtotal: number
  discount: number
  taxable: number
  hsn_code?: string
  gst_rate_bps?: number
  cgst?: number
  sgst?: number
  utgst?: number
  igst?: number
  tax?: number
  total: number
  batches: Allocation[]
}

export interface Order {
  id: string
  number: string
  retailer_id: string
  retailer_name: string
  distributor_id: string
  driver_id: string | null
  address: string
  payment_method: 'cod' | 'credit'
  payment_status: PaymentStatus
  status: OrderStatus
  created_at: string
  lines: OrderLine[]
  subtotal?: number
  discount?: number
  taxable?: number
  cgst?: number
  sgst?: number
  utgst?: number
  igst?: number
  total: number
  supply_state_code?: string
  supplier_state_code?: string
  tax_type?: string
  supplier?: Partial<User>
  buyer?: Partial<User>
  history: Array<{ status: OrderStatus; at: string; by: string }>
  tracking: Array<{ latitude: number; longitude: number; at: string }>
  proof_of_delivery?: {
    recipient_name: string
    signature: number[][][]
    captured_at: string
    captured_by: string
  }
  return_request?: ReturnRequest
}

export interface ReturnRequest {
  id: string
  order_id: string
  status: 'requested' | 'approved' | 'rejected'
  reason: string
  requested_at: string
  review_note?: string
  reviewed_at?: string
}

export interface Quote {
  lines: OrderLine[]
  subtotal: number
  discount: number
  taxable: number
  cgst: number
  sgst: number
  utgst: number
  igst: number
  tax: number
  total: number
  distributor_id: string
  supply_state_code: string
  supplier_state_code: string
  tax_type: string
}

export interface Payment {
  id: string
  order_id: string
  order_number: string
  amount: number
  reference: string
  at: string
}

export interface Notification {
  id: string
  title: string
  body: string
  at: string
  read: boolean
}

export interface AppState {
  business_date: string
  user: User
  users: User[]
  products: Product[]
  orders: Order[]
  payments: Payment[]
  notifications: Notification[]
  pricing: { bulk_min: number; bulk_discount_bps: number }
  audit: Array<{ id: string; action: string; detail: string; name: string; at: string }>
  directory: { base_dn: string; bind_dn: string; listener_enabled?: boolean; url?: string }
}

export interface AuthResponse {
  user: User
  csrf: string
  license: LicenseStatus
}

export interface ApiProblem {
  error: string
  code?: string
  license?: LicenseStatus
}

export interface ProductInput {
  id?: string
  name: string
  brand: string
  generic_name: string
  strength: string
  dosage_form: string
  category: string
  manufacturer: string
  unit: string
  sku?: string
  price: number
  hsn_code: string
  gst_rate_bps: number
  storage_conditions: string
  reorder: number
  active?: boolean
  distributor_id?: string
  stock?: number
}

export interface BatchInput {
  product_id: string
  batch_number: string
  manufacturing_date: string
  expiry_date: string
  stock: number
  mrp: number
  purchase_price: number
  source?: 'new' | 'unallocated'
}

export interface NewUserInput {
  name: string
  business: string
  email: string
  password: string
  role: Role
  credit_limit?: number
  address?: string
}

export interface BusinessInput {
  user_id: string
  legal_name: string
  address: string
  state_code: string
  gstin: string
  drug_license: string
}
