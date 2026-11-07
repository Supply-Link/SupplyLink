import { ArrowRight, CheckCircle2, ClipboardList, Package, Truck, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { BarChart, Card, Empty, OrderTable, PageHeader, Stat } from '../components'
import { OrderDetail } from '../components/orders/OrderDetail'
import { money } from '../lib/helpers'
import { useAuth } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'
import type { Order } from '../types'

const currentHour = new Date().getHours()
const greetingPeriod = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'

function getHeroTagline(role: string | undefined) {
  if (role === 'retailer') return 'Your pharmacy restock starts here.'
  if (role === 'delivery') return 'Every delivery makes a difference.'
  return 'Your supply chain, working together.'
}

export function DashboardScreen() {
  const state = usePageData<'dashboard'>()
  const { user } = useAuth()
  const [selected, setSelected] = useState<Order | null>(null)
  const orders = state?.orders ?? []
  const products = state?.products ?? []
  const valid = orders.filter((order) => order.status !== 'cancelled')
  const active = valid.filter((order) => order.status !== 'delivered')
  const low = products.filter((product) => product.active && product.stock <= product.reorder)
  const total = valid.reduce((sum, order) => sum + order.total, 0)
  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const [chartDays] = useState(() => Array.from({ length: 7 }, (_, index) => {
    const value = new Date()
    value.setDate(value.getDate() - 6 + index)
    return {
      key: value.toLocaleDateString('en-CA'),
      label: value.toLocaleDateString('en-IN', { weekday: 'short' }),
    }
  }))
  const chartData = chartDays.map((day) => {
    const value = valid.filter((order) => new Date(order.created_at).toLocaleDateString('en-CA') === day.key).reduce((sum, order) => sum + order.total, 0)
    return { label: day.label, value: value ?? 0, formattedValue: money(value ?? 0) }
  })
  return <>
    <PageHeader title={`Good ${greetingPeriod}, ${firstName}`} subtitle="Here's what's happening across your workspace." eyebrow={user?.business} />
    <section className="hero">
      <div><div className="eyebrow">A clearer view. A better day.</div><h2>{getHeroTagline(user?.role)}</h2><p>Bring orders, inventory, and fulfilment into one connected workspace.</p></div>
      <div className="hero-symbols"><Package /><ArrowRight /><Truck /><ArrowRight /><CheckCircle2 /></div>
    </section>
    <div className="stats">
      <Stat title="Total order value" value={money(total)} note="Excludes cancelled orders" icon={<WalletCards />} />
      <Stat title="Active orders" value={active.length} note="Moving through the supply chain" icon={<ClipboardList />} />
      <Stat title={user?.role === 'retailer' ? 'Available credit' : 'Low-stock products'} value={user?.role === 'retailer' ? money((state?.user?.credit_limit ?? 0) - (state?.user?.credit_used ?? 0)) : low.length} note="Live workspace data" icon={<Package />} />
      <Stat title="Completed orders" value={valid.filter((order) => order.status === 'delivered').length} note="Successfully delivered" icon={<CheckCircle2 />} />
    </div>
    <Card className="chart-card"><div className="card-head"><div><h2>Order activity</h2><p>Order value over the last 7 days</p></div><strong>{money(chartData.reduce((sum, datum) => sum + (datum.value ?? 0), 0))}</strong></div><div className="card-body"><BarChart data={chartData} ariaLabel="Seven-day order values" /></div></Card>
    <div className="grid-two">
      <Card><div className="card-head"><div><h2>Recent orders</h2><p>Your latest business activity</p></div></div><OrderTable orders={[...orders].reverse().slice(0, 5)} role={user?.role} onView={setSelected} /></Card>
      <Card><div className="card-head"><div><h2>{low.length ? 'Inventory attention' : 'Workspace status'}</h2><p>Live operational signals</p></div></div><div className="card-body">{low.slice(0, 5).map((product) => <div className="activity" key={product.id}><Package /><div><b>{product.name}</b><small>{product.stock} packs · reorder at {product.reorder}</small></div></div>)}{!low.length && <Empty title="Everything looks healthy">No stock items need attention.</Empty>}</div></Card>
    </div>
    {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
  </>
}
