import { createPageMutation } from './createPageMutation'
import type { BusinessInput, User } from '../../types'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('business', (signal) =>
  request<PagePayloads['business']>('/api/business', { signal }),
)
export { load as loadBusiness }
export default reducer

export const saveBusiness = createPageMutation('commands/saveBusiness', (body: BusinessInput, { signal }) =>
  request<Pick<User, 'id' | 'business' | 'legal_name' | 'address' | 'gstin' | 'state_code' | 'drug_license'>>('/api/business', { body, signal }), ['business', 'dashboard', 'catalog', 'orders', 'payments', 'inventory', 'people', 'activity', 'shell'])
