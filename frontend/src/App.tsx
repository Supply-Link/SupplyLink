import { Component, lazy, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { PageDataBoundary } from './components/layout/PageDataBoundary'
import { reportError } from './lib/logger'
import type { Role } from './types'
import { useAuth } from './providers/AppProviders'
import { LoginScreen } from './screens/LoginScreen'
import { RegisterScreen } from './screens/RegisterScreen'
import { LicenseLockScreen } from './screens/LicenseLockScreen'

const lazyScreen = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(() => loader().then((module) => {
  if (typeof module[name] !== 'function') throw new Error(`Screen "${String(name)}" not found in module`)
  return { default: module[name] as ComponentType }
}))

const Dashboard = lazyScreen(() => import('./screens/DashboardScreen'), 'DashboardScreen')
const Catalog = lazyScreen(() => import('./screens/CatalogScreen'), 'CatalogScreen')
const Orders = lazyScreen(() => import('./screens/OrdersScreen'), 'OrdersScreen')
const Deliveries = lazyScreen(() => import('./screens/DeliveriesScreen'), 'DeliveriesScreen')
const Payments = lazyScreen(() => import('./screens/PaymentsScreen'), 'PaymentsScreen')
const Credit = lazyScreen(() => import('./screens/CreditScreen'), 'CreditScreen')
const Inventory = lazyScreen(() => import('./screens/InventoryScreen'), 'InventoryScreen')
const People = lazyScreen(() => import('./screens/PeopleScreen'), 'PeopleScreen')
const Pricing = lazyScreen(() => import('./screens/PricingScreen'), 'PricingScreen')
const Activity = lazyScreen(() => import('./screens/ActivityScreen'), 'ActivityScreen')
const Business = lazyScreen(() => import('./screens/BusinessScreen'), 'BusinessScreen')
const Directory = lazyScreen(() => import('./screens/DirectoryScreen'), 'DirectoryScreen')
const Notifications = lazyScreen(() => import('./screens/NotificationsScreen'), 'NotificationsScreen')

function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, license, booting } = useAuth()
  if (booting) return <main className="auth-check" role="status">Checking your session…</main>
  if (!user) return <Navigate to="/login" replace />
  if (!license?.usable) return <LicenseLockScreen />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { reportError(error, { info }) }
  render() {
    if (this.state.error) return <main className="fatal"><h1>Something went wrong</h1><p>{this.state.error.message}</p><button onClick={() => window.location.reload()}>Reload workspace</button></main>
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />
            <Route path="/" element={<Protected><AppShell /></Protected>}>
              <Route index element={<PageDataBoundary page="dashboard"><Dashboard /></PageDataBoundary>} />
              <Route path="catalog" element={<Protected roles={['retailer']}><PageDataBoundary page="catalog"><Catalog /></PageDataBoundary></Protected>} />
              <Route path="orders" element={<Protected roles={['admin', 'distributor', 'retailer']}><PageDataBoundary page="orders"><Orders /></PageDataBoundary></Protected>} />
              <Route path="deliveries" element={<Protected roles={['admin', 'distributor', 'delivery']}><PageDataBoundary page="deliveries"><Deliveries /></PageDataBoundary></Protected>} />
              <Route path="payments" element={<Protected roles={['distributor']}><PageDataBoundary page="payments"><Payments /></PageDataBoundary></Protected>} />
              <Route path="credit" element={<Protected roles={['admin', 'retailer']}><PageDataBoundary page="credit"><Credit /></PageDataBoundary></Protected>} />
              <Route path="inventory" element={<Protected roles={['admin', 'distributor']}><PageDataBoundary page="inventory"><Inventory /></PageDataBoundary></Protected>} />
              <Route path="people" element={<Protected roles={['admin']}><PageDataBoundary page="people"><People /></PageDataBoundary></Protected>} />
              <Route path="pricing" element={<Protected roles={['admin']}><PageDataBoundary page="pricing"><Pricing /></PageDataBoundary></Protected>} />
              <Route path="activity" element={<Protected roles={['admin']}><PageDataBoundary page="activity"><Activity /></PageDataBoundary></Protected>} />
              <Route path="business" element={<Protected roles={['admin', 'distributor', 'retailer']}><PageDataBoundary page="business"><Business /></PageDataBoundary></Protected>} />
              <Route path="directory" element={<Protected roles={['admin']}><PageDataBoundary page="directory"><Directory /></PageDataBoundary></Protected>} />
              <Route path="notifications" element={<PageDataBoundary page="notifications"><Notifications /></PageDataBoundary>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
