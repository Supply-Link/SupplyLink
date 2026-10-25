import { CheckCircle2, Package, Truck, Users } from 'lucide-react'
import { useState } from 'react'
import { Card, OrderTable, PageHeader, Stat } from '../components'
import { OrderDetail } from '../components/orders/OrderDetail'
import { useAuth } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'
import type { Order } from '../types'

export function Deliveries() {
  const state = usePageData<'deliveries'>()
  const { user } = useAuth()
  const [selected, setSelected] = useState<Order | null>(null)
  const orders = state.orders.filter((order) => order.driver_id || order.status === 'packed')
  return <>
    <PageHeader title={user?.role === 'delivery' ? 'My deliveries' : 'Deliveries'} subtitle="Coordinate the last mile with clear ownership and status." eyebrow={state.user.business} />
    <div className="stats"><Stat title="Ready to dispatch" value={orders.filter((order) => order.status === 'packed').length} note="Packed and ready" icon={<Package />} /><Stat title="On the road" value={orders.filter((order) => order.status === 'out_for_delivery').length} note="Currently in progress" icon={<Truck />} /><Stat title="Delivered" value={orders.filter((order) => order.status === 'delivered').length} note="Successfully completed" icon={<CheckCircle2 />} /><Stat title="Assigned partners" value={new Set(orders.map((order) => order.driver_id).filter(Boolean)).size} note="Partners with orders" icon={<Users />} /></div>
    <Card><div className="card-head"><div><h2>Delivery board</h2><p>Select an order for dispatch, location, and completion.</p></div></div><OrderTable orders={[...orders].reverse()} role={user?.role} onView={setSelected} /></Card>
    {selected && <OrderDetail order={state.orders.find((order) => order.id === selected.id) || selected} onClose={() => setSelected(null)} />}
  </>
}
