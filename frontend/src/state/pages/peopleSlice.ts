import { createPageMutation } from './createPageMutation'
import type { NewUserInput, Role, User } from '../../types'
import { request } from '../../lib/http'
import type { PagePayloads } from './types'
import { createPageSlice } from './createPageSlice'

const { load, reducer } = createPageSlice('people', (signal) =>
  request<PagePayloads['people']>('/api/people', { signal }),
)
export { load as loadPeople }
export default reducer

export const updateUser = createPageMutation('commands/updateUser', (
  body: { id: string; credit_limit?: number; active?: boolean }, { signal },
) => request<User>('/api/users', { body, signal }), ['people', 'directory', 'credit', 'business', 'inventory', 'orders', 'deliveries', 'payments', 'dashboard', 'activity', 'notifications', 'shell'])

export const createUser = createPageMutation('commands/createUser', (body: NewUserInput, { signal }) =>
  request<User>('/api/users', { body, signal }), ['people', 'directory', 'credit', 'business', 'inventory', 'orders', 'deliveries', 'payments', 'dashboard', 'activity', 'notifications', 'shell'])

export const approveRegistration = createPageMutation('commands/approveRegistration', (
  body: { user_id: string; role: Role }, { signal },
) => request<User>('/api/registrations/approve', { body, signal }), ['people', 'directory', 'credit', 'business', 'inventory', 'orders', 'deliveries', 'payments', 'dashboard', 'activity', 'notifications', 'shell'])

export const rejectRegistration = createPageMutation('commands/rejectRegistration', (
  body: { user_id: string; reason: string }, { signal },
) => request<User>('/api/registrations/reject', { body, signal }), ['people', 'directory', 'credit', 'business', 'inventory', 'orders', 'deliveries', 'payments', 'dashboard', 'activity', 'notifications', 'shell'])
