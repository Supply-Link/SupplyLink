import { Suspense, useEffect } from 'react'
import {
  Activity, Bell, Boxes, Building2, ClipboardList, CreditCard, LayoutDashboard, LogOut,
  Menu, PackageCheck, Settings2, ShieldCheck, ShoppingBasket, Truck, Users, WalletCards,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../../state/actions'
import { useAppSelector } from '../../state/store'
import type { Role } from '../../api/types'
import { ROLE_NAMES } from '../../lib/constants'
import { useAuth } from '../../providers/AppProviders'
import { Avatar, IconButton, Button } from '../ui'
import { WorkspaceSkeleton } from './WorkspaceSkeleton'

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'distributor', 'retailer', 'delivery'] },
  { to: '/catalog', label: 'Medicine catalog', icon: ShoppingBasket, roles: ['retailer'] },
  { to: '/orders', label: 'Orders', icon: ClipboardList, roles: ['admin', 'distributor', 'retailer'] },
  { to: '/deliveries', label: 'Deliveries', icon: Truck, roles: ['admin', 'distributor', 'delivery'] },
  { to: '/payments', label: 'Payments', icon: WalletCards, roles: ['admin', 'distributor', 'retailer', 'delivery'] },
  { to: '/credit', label: 'Trade credit', icon: CreditCard, roles: ['admin', 'retailer'] },
  { to: '/inventory', label: 'Medicines & inventory', icon: Boxes, roles: ['admin', 'distributor'] },
  { to: '/people', label: 'People & roles', icon: Users, roles: ['admin'] },
  { to: '/pricing', label: 'Pricing rules', icon: Settings2, roles: ['admin'] },
  { to: '/activity', label: 'Activity log', icon: Activity, roles: ['admin'] },
  { to: '/business', label: 'Business & GST', icon: Building2, roles: ['admin', 'distributor', 'retailer'] },
  { to: '/directory', label: 'LDAP directory', icon: ShieldCheck, roles: ['admin'] },
  { to: '/notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'distributor', 'retailer', 'delivery'] },
] satisfies Array<{ to: string; label: string; icon: typeof Boxes; roles: Role[] }>

const todayLabel = new Date().toLocaleDateString('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function AppShell({ pending = false }: { pending?: boolean }) {
  const { user, license, logout } = useAuth()
  const data = useAppSelector((state) => state.portal.workspace)
  const status = useAppSelector((state) => state.portal.workspaceStatus)
  const error = useAppSelector((state) => state.portal.error)
  useEffect(() => { if (!pending && user && license?.usable && status === 'idle') void api.state().catch(() => undefined) }, [pending, user, license?.usable, status])
  const unread = data?.notifications.filter((item) => !item.read).length ?? 0
  return <div className="shell">
    <aside className="sidebar" id="sidebar">
      <div className="brand"><span><PackageCheck /></span>SupplyLink</div>
      <div className="workspace-label">{user ? ROLE_NAMES[user.role] : 'SupplyLink'} workspace</div>
      <nav>{nav.filter((item) => user ? item.roles.includes(user.role) : item.to === '/').map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}><item.icon /> {item.label}</NavLink>)}</nav>
      <div className="sidebar-footer">
        <div className="local-note"><b><i />Local workspace</b>Changes saved to your data file.<br />INR · Manual payments</div>
        {user && <div className="profile"><Avatar name={user.name} /><div><strong>{user.name}</strong><small>{ROLE_NAMES[user.role]}</small></div><IconButton label="Sign out" onClick={() => void logout()}><LogOut /></IconButton></div>}
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <IconButton label="Open navigation" className="mobile-menu" onClick={() => document.querySelector('.sidebar')?.classList.toggle('open')}><Menu /></IconButton>
        <div><span>Workspace</span><b> / SupplyLink</b></div>
        <div className="top-actions"><span>{todayLabel}</span><NavLink to="/notifications" className="notification-button" aria-label={data ? `${unread} unread notifications` : 'Notifications'}><Bell />{unread > 0 && <b>{unread}</b>}</NavLink>{user && <Avatar name={user.business} title={user.business} />}</div>
      </header>
      <div className="content">
        {pending || (!data && status !== 'error') ? <WorkspaceSkeleton /> : !data ? <section className="card inset" role="alert"><h2>Workspace unavailable</h2><p>{error ?? 'Unable to load workspace data.'}</p><Button onClick={() => void api.state().catch(() => undefined)}>Try again</Button></section> : <Suspense fallback={<WorkspaceSkeleton />}><Outlet context={data} /></Suspense>}
        <footer>SupplyLink · Pharma distribution, connected.<span>All amounts in INR</span></footer>
      </div>
    </main>
  </div>
}
