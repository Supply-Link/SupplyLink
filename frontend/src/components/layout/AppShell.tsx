import { useQuery } from '@tanstack/react-query'
import {
  Activity, Bell, Boxes, Building2, ClipboardList, CreditCard, LayoutDashboard, LogOut,
  Menu, PackageCheck, Settings2, ShieldCheck, ShoppingBasket, Truck, Users, WalletCards,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { api } from '../../api/endpoints'
import type { Role } from '../../api/types'
import { ROLE_NAMES } from '../../lib/constants'
import { useAuth } from '../../providers/AppProviders'
import { Avatar, IconButton, Loading } from '../ui'

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

export function AppShell() {
  const { user, license, logout } = useAuth()
  const { data, isLoading, error } = useQuery({
    queryKey: ['state'],
    queryFn: api.state,
    enabled: Boolean(user && license?.usable),
  })
  if (isLoading) return <Loading />
  if (error || !data || !user) throw error ?? new Error('Workspace data is unavailable.')
  const unread = data.notifications.filter((item) => !item.read).length
  return <div className="shell">
    <aside className="sidebar" id="sidebar">
      <div className="brand"><span><PackageCheck /></span>SupplyLink</div>
      <div className="workspace-label">{ROLE_NAMES[user.role]} workspace</div>
      <nav>{nav.filter((item) => item.roles.includes(user.role)).map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'}><item.icon /> {item.label}</NavLink>)}</nav>
      <div className="sidebar-footer">
        <div className="local-note"><b><i />Local workspace</b>Changes saved to your data file.<br />INR · Manual payments</div>
        <div className="profile"><Avatar name={user.name} /><div><strong>{user.name}</strong><small>{ROLE_NAMES[user.role]}</small></div><IconButton label="Sign out" onClick={() => void logout()}><LogOut /></IconButton></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <IconButton label="Open navigation" className="mobile-menu" onClick={() => document.querySelector('.sidebar')?.classList.toggle('open')}><Menu /></IconButton>
        <div><span>Workspace</span><b> / SupplyLink</b></div>
        <div className="top-actions"><span>{todayLabel}</span><NavLink to="/notifications" className="notification-button" aria-label={`${unread} unread notifications`}><Bell />{unread > 0 && <b>{unread}</b>}</NavLink><Avatar name={user.business} title={user.business} /></div>
      </header>
      <div className="content"><Outlet context={data} /><footer>SupplyLink · Pharma distribution, connected.<span>All amounts in INR</span></footer></div>
    </main>
  </div>
}
