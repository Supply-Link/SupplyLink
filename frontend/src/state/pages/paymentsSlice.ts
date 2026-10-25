import { createPageMutation } from './createPageMutation'
import type { Payment } from '../../types'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('payments', (signal) =>
  request<PagePayloads['payments']>('/api/payments', { signal }),
)
export { load as loadPayments }
export default reducer

export const recordPayment = createPageMutation('commands/recordPayment', (
  { body, key }: { body: { order_id: string; amount: number; reference: string }; key: string },
  { signal },
) => request<Payment>('/api/payments', { body, idempotencyKey: key, signal }), ['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell'])
