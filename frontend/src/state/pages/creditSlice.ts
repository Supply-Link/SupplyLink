import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('credit', (signal) =>
  request<PagePayloads['credit']>('/api/credit', { signal }),
)
export { load as loadCredit }
export default reducer
