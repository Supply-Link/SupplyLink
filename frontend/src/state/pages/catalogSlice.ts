import { createAsyncThunk } from '@reduxjs/toolkit'
import type { Quote } from '../../types'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('catalog', (signal) =>
  request<PagePayloads['catalog']>('/api/catalog', { signal }),
)
export { load as loadCatalog }
export default reducer

export const loadQuote = createAsyncThunk('commands/quote', (
  body: { items: Array<{ product_id: string; quantity: number }>; supply_state_code: string },
  { signal },
) => request<Quote>('/api/quote', { body, signal }))
