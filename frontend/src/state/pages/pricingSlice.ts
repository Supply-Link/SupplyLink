import { createPageMutation } from './createPageMutation'
import type { AppState } from '../../types'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('pricing', (signal) =>
  request<PagePayloads['pricing']>('/api/pricing', { signal }),
)
export { load as loadPricing }
export default reducer

export const savePricing = createPageMutation('commands/savePricing', (
  body: { bulk_min: number; bulk_discount_bps: number }, { signal },
) => request<AppState['pricing']>('/api/pricing', { body, signal }), ['pricing', 'catalog', 'activity'])
