import { CheckCircle2, ClipboardList, Download, Truck, WalletCards } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Empty, Notice, OrderTable, PageHeader, Stat } from '../components'
import { OrderDetail } from '../components/orders/OrderDetail'
import { dateTime, downloadCsv, money } from '../lib/helpers'
import { usePageData } from '../state/pageContext'
import type { Order } from '../types'

export function Payments() {
  const state = usePageData<'payments'>()
  const [selected, setSelected] = useState<Order | null>(null)
  const outstanding = state.orders.filter((order) => order.status !== 'cancelled' && order.payment_status !== 'paid')
  return <>
    <PageHeader title="Payments" subtitle="A transparent ledger of recorded offline payments." eyebrow={state.user.business} actions={<Button variant="secondary" onClick={() => downloadCsv('payments', state.payments)}><Download /> Export ledger</Button>} />
    <Notice>This portal records payments received outside the system. It does not process or transfer money.</Notice>
    <div className="stats"><Stat title="Total recorded" value={money(state.payments.reduce((sum, payment) => sum + payment.amount, 0))} note="Offline receipts" icon={<WalletCards />} /><Stat title="Outstanding" value={money(outstanding.reduce((sum, order) => sum + order.total, 0))} note="Non-cancelled orders" icon={<ClipboardList />} /><Stat title="Recorded payments" value={state.payments.length} note="Full-order settlements" icon={<CheckCircle2 />} /><Stat title="Awaiting collection" value={outstanding.filter((order) => order.status === 'delivered').length} note="Delivered and unpaid" icon={<Truck />} /></div>
    <Card><div className="card-head"><h2>Awaiting payment</h2></div><OrderTable orders={[...outstanding].reverse()} role={state.user.role} onView={setSelected} /></Card>
    <h2 className="section-title">Payment ledger</h2>
    <Card>{state.payments.length ? <div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Order</th><th>Amount</th><th>Reference</th><th>Recorded</th></tr></thead><tbody>{[...state.payments].reverse().map((payment) => <tr key={payment.id}><td><strong>{payment.id}</strong><small>Manual receipt</small></td><td>{payment.order_number}</td><td><strong>{money(payment.amount)}</strong></td><td>{payment.reference}</td><td>{dateTime(payment.at)}</td></tr>)}</tbody></table></div> : <Empty title="No payments recorded">Completed payment records will appear here.</Empty>}</Card>
    {selected && <OrderDetail order={state.orders.find((order) => order.id === selected.id) || selected} onClose={() => setSelected(null)} />}
  </>
}
