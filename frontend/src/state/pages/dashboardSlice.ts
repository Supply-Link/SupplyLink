import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('dashboard', (signal) =>
  request<PagePayloads['dashboard']>('/api/dashboard', { signal }),
)
export { load as loadDashboard }
export default reducer
