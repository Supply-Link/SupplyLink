import { createPageMutation } from './createPageMutation'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('notifications', (signal) =>
  request<PagePayloads['notifications']>('/api/notifications', { signal }),
)
export { load as loadNotifications }
export default reducer

export const readNotifications = createPageMutation('commands/readNotifications', (_, { signal }) =>
  request<{ ok: boolean }>('/api/notifications/read', { body: {}, signal }), ['notifications', 'shell'])
