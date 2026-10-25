import { Provider } from 'react-redux'
import { createAppStore } from '../state/store'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentType } from 'react'
import type { PageName, PagePayloads } from '../state/pages/types'
import type { Role, User } from '../types'
import { PageContext } from '../state/pageContext'
import { Dashboard } from './DashboardScreen'
import { Catalog } from './CatalogScreen'
import { Orders } from './OrdersScreen'
import { Deliveries } from './DeliveriesScreen'
import { Payments } from './PaymentsScreen'
import { Credit } from './CreditScreen'
import { People } from './PeopleScreen'
import { Pricing } from './PricingScreen'
import { Activity } from './ActivityScreen'
import { Business } from './BusinessScreen'
import { Directory } from './DirectoryScreen'
import { Notifications } from './NotificationsScreen'
import { Inventory } from './InventoryScreen'

const auth = vi.hoisted(() => ({ role: 'admin' as Role }))
vi.mock('../providers/AppProviders', () => ({
  useAuth: () => ({ user: { id: 'test', name: 'Test User', role: auth.role, business: 'Test Business' }, license: { usable: true } }),
  useToast: () => vi.fn(),
}))
const user = { id: 'test', name: 'Test User', business: 'Test Business', role: 'admin', active: true, approval_status: 'approved' } as User
const payloads: Omit<PagePayloads, 'shell'> = {
  dashboard: { user, products: [], orders: [], users: [] },
  catalog: { user, products: [] },
  orders: { user, orders: [], users: [] },
  deliveries: { user, orders: [], users: [] },
  payments: { user, orders: [], users: [], payments: [] },
  credit: { user, users: [] },
  inventory: { user, products: [], users: [] },
  people: { user, users: [] },
  pricing: { user, pricing: { bulk_min: 10, bulk_discount_bps: 100 } },
  activity: { user, audit: [] },
  business: { user, users: [user] },
  directory: { user, users: [], directory: { base_dn: 'dc=test', bind_dn: 'uid=test' } },
  notifications: { user, notifications: [] },
}
const pages: Array<[Exclude<PageName, 'shell'>, ComponentType, Role[]]> = [
  ['dashboard', Dashboard, ['admin', 'distributor', 'retailer', 'delivery']],
  ['catalog', Catalog, ['retailer']],
  ['orders', Orders, ['admin', 'distributor', 'retailer']],
  ['deliveries', Deliveries, ['admin', 'distributor', 'delivery']],
  ['payments', Payments, ['distributor']],
  ['credit', Credit, ['admin', 'retailer']],
  ['inventory', Inventory, ['admin', 'distributor']],
  ['people', People, ['admin']], ['pricing', Pricing, ['admin']],
  ['activity', Activity, ['admin']], ['business', Business, ['admin', 'distributor', 'retailer']],
  ['directory', Directory, ['admin']], ['notifications', Notifications, ['admin', 'distributor', 'retailer', 'delivery']],
]

describe('views accept their page-specific response for every allowed role', () => {
  for (const [name, View, roles] of pages) {
    it.each(roles)(`${name} renders for %s without a workspace payload`, (role) => {
      auth.role = role
      const payload = { ...payloads[name], user: { ...user, role } }
      render(<Provider store={createAppStore()}><QueryClientProvider client={new QueryClient()}><MemoryRouter><PageContext.Provider value={payload}><View /></PageContext.Provider></MemoryRouter></QueryClientProvider></Provider>)
      expect(screen.getByRole('heading', { level: 1 })).toBeVisible()
    })
  }
})
