import { createAction } from '@reduxjs/toolkit'
import type { PageName } from './types'

export const invalidatePages = createAction<PageName[]>('pages/invalidate')
export const refreshPages = createAction('pages/refresh')
