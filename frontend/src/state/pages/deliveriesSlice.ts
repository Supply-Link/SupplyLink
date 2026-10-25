import { createPageMutation } from './createPageMutation'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('deliveries', (signal) =>
  request<PagePayloads['deliveries']>('/api/deliveries', { signal }),
)
export { load as loadDeliveries }
export default reducer

export const trackDelivery = createPageMutation('commands/track', (
  body: { order_id: string; latitude: number; longitude: number },
  { signal },
) => request<{ latitude: number; longitude: number; at: string }>('/api/tracking', { body, signal }), ['dashboard', 'catalog', 'orders', 'deliveries', 'payments', 'credit', 'inventory', 'activity', 'notifications', 'shell'])
