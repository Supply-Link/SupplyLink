export type Role = 'admin' | 'distributor' | 'retailer' | 'delivery';

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'packed'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export interface User {
  id: string;
  name: string;
  role: Role;
  email?: string;
  business?: string;
  legal_name?: string;
  address?: string;
  state_code?: string;
  gstin?: string;
  drug_license?: string;
  credit_limit?: number;
  credit_used?: number;
}

export interface Licence {
  usable?: boolean;
  status?: string;
  server_time?: string;
  expires_at?: string | null;
  expires_on?: string | null;
}

export interface Batch {
  id: string;
  batch_number: string;
  manufacturing_date: string;
  expiry_date: string;
  mrp: number;
  stock: number;
  status: string;
}

export interface Product {
  id: string;
  name: string;
  generic_name?: string;
  strength?: string;
  manufacturer?: string;
  unit?: string;
  category?: string;
  storage_conditions?: string;
  price: number;
  stock: number;
  hsn_code?: string;
  gst_rate_bps?: number;
  batches?: Batch[];
}

export interface TaxTotals {
  subtotal?: number;
  discount?: number;
  taxable?: number;
  cgst?: number;
  sgst?: number;
  utgst?: number;
  igst?: number;
  tax?: number;
  total: number;
}

export interface BatchAllocation {
  batch_number: string;
  expiry_date: string;
  manufacturing_date?: string;
  mrp: number;
  quantity: number;
}

export interface OrderLine {
  product_id: string;
  name: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  hsn_code?: string;
  gst_rate_bps?: number;
  tax?: number;
  batches?: BatchAllocation[];
}

export interface Quote extends TaxTotals {
  lines: OrderLine[];
  supply_state_code: string;
  tax_type: string;
}

export interface ProofOfDelivery {
  recipient_name: string;
  signature: number[][][];
  captured_at: string;
  captured_by: string;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  status: 'requested' | 'approved' | 'rejected';
  reason: string;
  requested_at: string;
  review_note?: string;
  reviewed_at?: string;
}

export interface Order extends TaxTotals {
  id: string;
  number: string;
  status: OrderStatus;
  payment_method: 'cod' | 'credit';
  payment_status: string;
  retailer_name: string;
  address: string;
  created_at: string;
  supply_state_code?: string;
  tax_type?: string;
  lines: OrderLine[];
  history: { status: OrderStatus; at: string; by: string }[];
  tracking: { latitude: number; longitude: number; at: string }[];
  proof_of_delivery?: ProofOfDelivery;
  return_request?: ReturnRequest;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface Payment {
  id: string;
  order_id: string;
  order_number: string;
  amount: number;
  reference: string;
  at: string;
}

export interface Workspace {
  user: User;
  products: Product[];
  orders: Order[];
  notifications: Notification[];
  payments: Payment[];
}

export interface AuthResponse {
  user: User;
  csrf: string;
  license: Licence;
}
