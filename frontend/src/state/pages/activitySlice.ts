import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('activity', (signal) =>
  request<PagePayloads['activity']>('/api/activity', { signal }),
)
export { load as loadActivity }
export default reducer
