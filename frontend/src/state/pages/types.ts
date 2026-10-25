import type { AppState, User } from '../../types'

export interface PagePayloads {
  dashboard: Pick<AppState, 'user' | 'products' | 'orders' | 'users'>
  catalog: Pick<AppState, 'user' | 'products'>
  orders: Pick<AppState, 'user' | 'orders' | 'users'>
  deliveries: Pick<AppState, 'user' | 'orders' | 'users'>
  payments: Pick<AppState, 'user' | 'orders' | 'users' | 'payments'>
  credit: Pick<AppState, 'user' | 'users'>
  inventory: Pick<AppState, 'user' | 'products' | 'users'>
  people: Pick<AppState, 'user' | 'users'>
  pricing: Pick<AppState, 'user' | 'pricing'>
  activity: Pick<AppState, 'user' | 'audit'>
  business: Pick<AppState, 'user' | 'users'>
  directory: Pick<AppState, 'user' | 'users' | 'directory'>
  notifications: Pick<AppState, 'user' | 'notifications'>
  shell: { user: User; unread_notifications: number }
}
export type PageName = keyof PagePayloads

