import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('directory', (signal) =>
  request<PagePayloads['directory']>('/api/directory', { signal }),
)
export { load as loadDirectory }
export default reducer
