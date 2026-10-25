import { createPageMutation } from './createPageMutation'
import type { Order, OrderStatus, ReturnRequest } from '../../types'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('orders', (signal) =>
  request<PagePayloads['orders']>('/api/orders', { signal }),
)
export { load as loadOrders }
export default reducer

export const createOrder = createPageMutation('commands/createOrder', (
  { body, key }: { body: { items: Array<{ product_id: string; quantity: number }>; address: string; payment_method: 'cod' | 'credit'; supply_state_code: string; expected_total: number }; key: string },
  { signal },
) => request<Order>('/api/orders', { body, idempotencyKey: key, signal }), ['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell'])

export const updateOrder = createPageMutation('commands/updateOrder', (
  { id, body }: { id: string; body: { status: OrderStatus; driver_id?: string } },
  { signal },
) => request<Order>(`/api/orders/${encodeURIComponent(id)}`, { body, signal }), ['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell'])

export const reviewReturn = createPageMutation('commands/reviewReturn', (
  body: { order_id: string; action: 'approve' | 'reject'; review_note: string },
  { signal },
) => request<ReturnRequest>('/api/returns', { body, signal }), ['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell'])
