import { createPageMutation } from './createPageMutation'
import type { Batch, BatchInput, Product, ProductInput } from '../../types'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('inventory', (signal) =>
  request<PagePayloads['inventory']>('/api/inventory', { signal }),
)
export { load as loadInventory }
export default reducer

export const saveProduct = createPageMutation('commands/saveProduct', (body: ProductInput, { signal }) =>
  request<Product>('/api/products', { body, signal }), ['inventory', 'catalog', 'dashboard', 'activity'])
export const receiveBatch = createPageMutation('commands/receiveBatch', (body: BatchInput, { signal }) =>
  request<Batch>('/api/batches', { body, signal }), ['inventory', 'catalog', 'dashboard', 'activity'])
export const adjustStock = createPageMutation('commands/adjustStock', (
  body: { product_id: string; batch_id: string; change: number; reason: string }, { signal },
) => request<Batch>('/api/inventory', { body, signal }), ['inventory', 'catalog', 'dashboard', 'activity'])

export const setBatchQuarantine = createPageMutation('commands/setBatchQuarantine', (
  body: { product_id: string; batch_id: string; quarantined: boolean; reason: string }, { signal },
) => request<Batch>('/api/batches/quarantine', { body, signal }), ['inventory', 'catalog', 'dashboard', 'activity'])
