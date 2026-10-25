import { useLocation } from 'react-router-dom'
import { useAuth } from '../../providers/AppProviders'
import { PageHeader } from '../ui'

const pages: Record<string, [string, string]> = {
  '/': ['Overview', 'Here’s what’s happening across your workspace.'],
  '/catalog': ['Medicine catalog', 'Generic medicines. Clear stock visibility. Connected distribution.'],
  '/orders': ['Orders', 'Track each order from placement to delivery.'],
  '/deliveries': ['Deliveries', 'Coordinate the last mile with clear ownership and status.'],
  '/payments': ['Payments', 'A transparent ledger of recorded offline payments.'],
  '/credit': ['Trade credit', 'Manage purchasing capacity and outstanding balances.'],
  '/inventory': ['Medicines & inventory', 'Batch traceability, expiry visibility, and medicine tax details.'],
  '/people': ['People, roles & access', 'Approve registrations and control portal and LDAP access.'],
  '/pricing': ['Pricing rules', 'Straightforward bulk savings, calculated consistently on every order.'],
  '/activity': ['Activity log', 'A record of important changes across your workspace.'],
  '/business': ['Business & GST', 'Maintain business identity, tax registration, and supply-state details.'],
  '/directory': ['LDAP directory', 'One user directory, shared by portal and LDAP authentication.'],
  '/notifications': ['Notifications', 'Order milestones and updates, in one place.'],
}
const hour = new Date().getHours()

function Lines() {
  return <><div className="skeleton-line" /><div className="skeleton-line skeleton-short" /><div className="skeleton-line skeleton-tiny" /></>
}

function TablePlaceholder() {
  return <div className="card skeleton-table">{Array.from({ length: 6 }, (_, row) => <div className={`skeleton-table-row ${row === 0 ? 'skeleton-table-heading' : ''}`} key={row}>{Array.from({ length: 5 }, (_, col) => <div className={`skeleton-line ${col === 4 ? 'skeleton-tiny' : ''}`} key={col} />)}</div>)}</div>
}

/** Content-only placeholders follow the same grids and cards as the loaded routes. */
export function WorkspaceSkeleton() {
  const { pathname } = useLocation()
  const path = pathname.replace(/\/$/, '') || '/'
  const { user } = useAuth()
  const [defaultTitle, subtitle] = pages[path] ?? pages['/']
  const title = path === '/' && user ? `Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${user.name.split(' ')[0]}` : path === '/deliveries' && user?.role === 'delivery' ? 'My deliveries' : defaultTitle
  const stats = ['/', '/inventory', '/deliveries', '/payments', '/people', '/directory'].includes(path)
  const form = path === '/pricing' || path === '/business'
  return <section className="workspace-skeleton" aria-label={`Loading ${defaultTitle.toLowerCase()}`} aria-busy="true">
    <PageHeader title={title} subtitle={subtitle} eyebrow={user?.business} />
    <div aria-hidden="true">
      {path === '/' && <section className="hero"><div><div className="eyebrow">A clearer view. A better day.</div><h2>{user?.role === 'retailer' ? 'Your pharmacy restock starts here.' : user?.role === 'delivery' ? 'Every delivery makes a difference.' : 'Your supply chain, working together.'}</h2><p>Bring orders, inventory, and fulfilment into one connected workspace.</p></div></section>}
      {stats && <div className="stats">{Array.from({ length: 4 }, (_, i) => <div className="card stat" key={i}><Lines /></div>)}</div>}
      {['/catalog', '/orders', '/inventory', '/people'].includes(path) && <div className="toolbar"><div className="skeleton-control" /><div className="skeleton-control skeleton-search" /></div>}
      {path === '/catalog' ? <div className="catalog-grid">{Array.from({ length: 8 }, (_, i) => <div className="card product-card" key={i}><div className="product-art skeleton-fill" /><div className="product-body"><Lines /><div className="price-row"><div className="skeleton-line skeleton-short" /></div></div></div>)}</div>
        : form ? <div className="card narrow-card"><div className="card-head"><div className="skeleton-line skeleton-short" /></div><div className="card-body"><div className="form-grid">{Array.from({ length: path === '/pricing' ? 2 : 6 }, (_, i) => <div key={i}><div className="skeleton-line skeleton-tiny" /><div className="skeleton-input" /></div>)}</div><div className="modal-actions"><div className="skeleton-control" /></div></div></div>
        : path === '/notifications' ? <div className="notifications">{Array.from({ length: 4 }, (_, i) => <div className="card notification" key={i}><Lines /></div>)}</div>
        : path === '/credit' || path === '/directory' ? <div className={path === '/credit' ? 'credit-grid' : 'grid-two'}>{Array.from({ length: path === '/credit' && user?.role !== 'retailer' ? 4 : path === '/credit' ? 1 : 2 }, (_, i) => <div className="card" key={i}><div className="card-head"><div className="skeleton-line skeleton-short" /></div><div className="card-body"><Lines /><div className="skeleton-input" /><Lines /></div></div>)}</div>
        : path === '/' ? <><div className="card chart-card"><div className="card-head"><h2>Order activity</h2></div><div className="card-body"><div className="skeleton-chart skeleton-fill" /></div></div><div className="grid-two"><TablePlaceholder /><div className="card card-body"><Lines /><Lines /></div></div></>
        : <><TablePlaceholder />{path === '/payments' && <><h2 className="section-title">Payment ledger</h2><TablePlaceholder /></>}</>}
    </div>
  </section>
}
