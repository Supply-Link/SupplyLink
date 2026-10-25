import { Component, lazy, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { PageDataBoundary } from './components/layout/PageDataBoundary'
import type { Role } from './types'
import { useAuth } from './providers/AppProviders'
import { Login } from './screens/LoginScreen'
import { Register } from './screens/RegisterScreen'
import { LicenseLock } from './screens/LicenseLockScreen'

const lazyScreen = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(() => loader().then((module) => ({ default: module[name] as ComponentType })))

const Dashboard = lazyScreen(() => import('./screens/DashboardScreen'), 'Dashboard')
const Catalog = lazyScreen(() => import('./screens/CatalogScreen'), 'Catalog')
const Orders = lazyScreen(() => import('./screens/OrdersScreen'), 'Orders')
const Deliveries = lazyScreen(() => import('./screens/DeliveriesScreen'), 'Deliveries')
const Payments = lazyScreen(() => import('./screens/PaymentsScreen'), 'Payments')
const Credit = lazyScreen(() => import('./screens/CreditScreen'), 'Credit')
const Inventory = lazyScreen(() => import('./screens/InventoryScreen'), 'Inventory')
const People = lazyScreen(() => import('./screens/PeopleScreen'), 'People')
const Pricing = lazyScreen(() => import('./screens/PricingScreen'), 'Pricing')
const Activity = lazyScreen(() => import('./screens/ActivityScreen'), 'Activity')
const Business = lazyScreen(() => import('./screens/BusinessScreen'), 'Business')
const Directory = lazyScreen(() => import('./screens/DirectoryScreen'), 'Directory')
const Notifications = lazyScreen(() => import('./screens/NotificationsScreen'), 'Notifications')

function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, license, booting } = useAuth()
  if (booting) return <main className="auth-check" role="status">Checking your session…</main>
  if (!user) return <Navigate to="/login" replace />
  if (!license?.usable) return <LicenseLock />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info) }
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
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Protected><AppShell /></Protected>}>
              <Route index element={<PageDataBoundary page="dashboard"><Dashboard /></PageDataBoundary>} />
              <Route path="catalog" element={<Protected roles={['retailer']}><PageDataBoundary page="catalog"><Catalog /></PageDataBoundary></Protected>} />
              <Route path="orders" element={<Protected roles={['admin', 'distributor', 'retailer']}><PageDataBoundary page="orders"><Orders /></PageDataBoundary></Protected>} />
              <Route path="deliveries" element={<Protected roles={['admin', 'distributor', 'delivery']}><PageDataBoundary page="deliveries"><Deliveries /></PageDataBoundary></Protected>} />
              <Route path="payments" element={<PageDataBoundary page="payments"><Payments /></PageDataBoundary>} />
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
