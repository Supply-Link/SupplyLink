import { Download } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, OrderTable, PageHeader, SearchInput, Tabs } from '../components'
import { OrderDetail } from '../components/orders/OrderDetail'
import { ORDER_STATUSES } from '../lib/constants'
import { downloadCsv, label } from '../lib/helpers'
import { useAuth } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'
import type { Order } from '../types'

export function Orders() {
  const state = usePageData<'orders'>()
  const { user } = useAuth()
  const [filter, setFilter] = useState<(typeof ORDER_STATUSES)[number]>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Order | null>(null)
  const orders = state.orders.filter((order) => (filter === 'all' || order.status === filter) && `${order.number} ${order.retailer_name}`.toLowerCase().includes(query.toLowerCase())).reverse()
  return <>
    <PageHeader title="Orders" subtitle="Track each order from placement to delivery." eyebrow={state.user.business} actions={user?.role !== 'retailer' ? <Button variant="secondary" onClick={() => downloadCsv('orders', state.orders)}><Download /> Export CSV</Button> : undefined} />
    <div className="toolbar"><Tabs value={filter} options={ORDER_STATUSES.map((status) => ({ value: status, label: label(status) }))} onChange={setFilter} /><SearchInput value={query} onChange={setQuery} placeholder="Search order or retailer" /></div>
    <Card><OrderTable orders={orders} role={user?.role} onView={setSelected} /></Card>
    {selected && <OrderDetail order={state.orders.find((order) => order.id === selected.id) || selected} onClose={() => setSelected(null)} />}
  </>
}
