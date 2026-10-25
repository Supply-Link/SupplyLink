import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('shell', (signal) =>
  request<PagePayloads['shell']>('/api/shell', { signal }),
)
export { load as loadShell }
export default reducer
