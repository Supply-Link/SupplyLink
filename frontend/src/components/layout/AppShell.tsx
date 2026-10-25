import { Suspense, useEffect } from 'react'
import {
  Activity, Bell, Boxes, Building2, ClipboardList, CreditCard, LayoutDashboard, LogOut,
  Menu, PackageCheck, Settings2, ShieldCheck, ShoppingBasket, Truck, Users, WalletCards,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { loadShell } from '../../state/pages/shellSlice'
import { useAppDispatch, useAppSelector } from '../../state/store'
import type { Role } from '../../types'
import { ROLE_NAMES } from '../../lib/constants'
import { useAuth } from '../../providers/AppProviders'
import { Avatar, IconButton } from '../ui'
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
  const { user, navigationRole, license, logout } = useAuth()
  const role = user?.role ?? (pending ? navigationRole : null)
  const dispatch = useAppDispatch()
  const { data, status } = useAppSelector((state) => state.pages.shell)
  useEffect(() => { if (!pending && user && license?.usable && status === 'idle') void dispatch(loadShell()) }, [dispatch, pending, user, license?.usable, status])
  const unread = data && 'unread_notifications' in data ? data.unread_notifications : 0
  return <div className="shell">
    <aside className="sidebar" id="sidebar">
      <div className="brand"><span><PackageCheck /></span>SupplyLink</div>
      <div className="workspace-label">{role ? ROLE_NAMES[role] : 'SupplyLink'} workspace</div>
      <nav>{nav.filter((item) => role ? item.roles.includes(role) : item.to === '/').map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}><item.icon /> {item.label}</NavLink>)}</nav>
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
        {pending ? <WorkspaceSkeleton /> : <Suspense fallback={<WorkspaceSkeleton />}><Outlet /></Suspense>}
        <footer>SupplyLink · Pharma distribution, connected.<span>All amounts in INR</span></footer>
      </div>
    </main>
  </div>
}
