import { Component, lazy, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout'
import { PageSkeleton } from './components/ui'
import type { Role } from './api/types'
import { useAuth } from './providers/AppProviders'
import { Login, Register, LicenseLock } from './screens/AuthScreens'

const lazyScreen = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  name: K,
) => lazy(() => loader().then((module) => ({ default: module[name] as ComponentType })))

const Dashboard = lazyScreen(() => import('./screens/CoreScreens'), 'Dashboard')
const Catalog = lazyScreen(() => import('./screens/CoreScreens'), 'Catalog')
const Orders = lazyScreen(() => import('./screens/CoreScreens'), 'Orders')
const Deliveries = lazyScreen(() => import('./screens/CoreScreens'), 'Deliveries')
const Payments = lazyScreen(() => import('./screens/CoreScreens'), 'Payments')
const Credit = lazyScreen(() => import('./screens/CoreScreens'), 'Credit')
const Inventory = lazyScreen(() => import('./screens/InventoryScreen'), 'Inventory')
const People = lazyScreen(() => import('./screens/AdminScreens'), 'People')
const Pricing = lazyScreen(() => import('./screens/AdminScreens'), 'Pricing')
const Activity = lazyScreen(() => import('./screens/AdminScreens'), 'Activity')
const Business = lazyScreen(() => import('./screens/AdminScreens'), 'Business')
const Directory = lazyScreen(() => import('./screens/AdminScreens'), 'Directory')
const Notifications = lazyScreen(() => import('./screens/AdminScreens'), 'Notifications')

function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, license, booting } = useAuth()
  if (booting) return <PageSkeleton />
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
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Protected><AppShell /></Protected>}>
              <Route index element={<Dashboard />} />
              <Route path="catalog" element={<Protected roles={['retailer']}><Catalog /></Protected>} />
              <Route path="orders" element={<Protected roles={['admin', 'distributor', 'retailer']}><Orders /></Protected>} />
              <Route path="deliveries" element={<Protected roles={['admin', 'distributor', 'delivery']}><Deliveries /></Protected>} />
              <Route path="payments" element={<Payments />} />
              <Route path="credit" element={<Protected roles={['admin', 'retailer']}><Credit /></Protected>} />
              <Route path="inventory" element={<Protected roles={['admin', 'distributor']}><Inventory /></Protected>} />
              <Route path="people" element={<Protected roles={['admin']}><People /></Protected>} />
              <Route path="pricing" element={<Protected roles={['admin']}><Pricing /></Protected>} />
              <Route path="activity" element={<Protected roles={['admin']}><Activity /></Protected>} />
              <Route path="business" element={<Protected roles={['admin', 'distributor', 'retailer']}><Business /></Protected>} />
              <Route path="directory" element={<Protected roles={['admin']}><Directory /></Protected>} />
              <Route path="notifications" element={<Notifications />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
