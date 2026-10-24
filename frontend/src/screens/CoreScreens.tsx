import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight, CheckCircle2, ClipboardList, Download, MapPin, Package,
  ShoppingCart, Truck, Users, WalletCards,
} from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api/endpoints'
import { createIdempotencyKey } from '../api/client'
import type { AppState, Order, OrderStatus, Product } from '../api/types'
import { ORDER_STATUSES } from '../lib/constants'
import { buildOrderRequest, buildQuoteRequest, cartItems } from '../lib/checkout'
import { dateTime, downloadCsv, label, money } from '../lib/helpers'
import { useAuth, useToast } from '../providers/AppProviders'
import {
  Badge, BarChart, Button, Card, CreditMeter, DetailPair, Empty, Modal, Notice, OrderTable,
  PageHeader, ProductCard, ProductFacts, QuantityStepper, SearchInput, StateSelect,
  Stat, Tabs, TaxBreakdown, Timeline, BatchTable,
} from '../components'

const useAppState = () => useOutletContext<AppState>()
const currentHour = new Date().getHours()
const greetingPeriod = currentHour < 12 ? 'morning' : currentHour < 17 ? 'afternoon' : 'evening'

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const state = useAppState()
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [driverId, setDriverId] = useState('')
  const [reference, setReference] = useState('')
  const [coordinates, setCoordinates] = useState({ latitude: '', longitude: '' })
  const [confirmCancel, setConfirmCancel] = useState(false)
  const paymentKey = useRef(createIdempotencyKey())
  const refresh = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['state'] })
    toast(message)
    onClose()
  }
  const statusMutation = useMutation({
    mutationFn: (body: { status: OrderStatus; driver_id?: string }) => api.updateOrder(order.id, body),
    onSuccess: () => void refresh('Order updated.'),
    onError: (error) => toast(error.message, 'error'),
  })
  const paymentMutation = useMutation({
    mutationFn: () => api.recordPayment({ order_id: order.id, amount: order.total, reference }, paymentKey.current),
    onSuccess: () => void refresh('Offline payment recorded.'),
    onError: (error) => toast(error.message, 'error'),
  })
  const trackingMutation = useMutation({
    mutationFn: () => api.track({ order_id: order.id, latitude: Number(coordinates.latitude), longitude: Number(coordinates.longitude) }),
    onSuccess: () => void refresh('Delivery location shared.'),
    onError: (error) => toast(error.message, 'error'),
  })
  const canManage = user?.role === 'admin' || user?.role === 'distributor'
  const canCancel = Boolean(
    user && ['admin', 'distributor', 'retailer'].includes(user.role) &&
    (['placed', 'confirmed'].includes(order.status) || (canManage && order.status === 'packed')) &&
    order.payment_status === 'unpaid',
  )
  const drivers = state.users.filter((person) => person.role === 'delivery' && person.active)
  const driver = state.users.find((person) => person.id === order.driver_id)
  const latest = order.tracking.at(-1)
  const locate = () => {
    if (!navigator.geolocation) return toast('Your browser does not support location sharing.', 'error')
    navigator.geolocation.getCurrentPosition(
      (position) => setCoordinates({
        latitude: position.coords.latitude.toFixed(6),
        longitude: position.coords.longitude.toFixed(6),
      }),
      () => toast('Location unavailable. Enter the coordinates manually.', 'error'),
      { timeout: 12_000, maximumAge: 0 },
    )
  }
  return (
    <Modal title={order.number} subtitle={`Placed ${dateTime(order.created_at)} · ${order.retailer_name}`} onClose={onClose} wide>
      <div className="actions"><Badge value={order.status} /><Badge value={order.payment_status} /><Badge value={order.payment_method === 'credit' ? 'Trade credit' : 'Cash on delivery'} /></div>
      <Card className="inset">
        <h3>Batch & GST details</h3>
        {order.lines.map((line) => <div className="order-line" key={line.product_id}>
          <DetailPair label={<strong>{line.name}</strong>} value={<strong>{money(line.total)}</strong>} />
          <p>{line.quantity} packs × {money(line.unit_price)} excl. GST · HSN {line.hsn_code || 'Not recorded'} · GST {line.gst_rate_bps === undefined ? 'Not recorded' : `${line.gst_rate_bps / 100}%`}</p>
          {line.batches?.map((batch) => <div className="allocation" key={batch.batch_id}><b>{batch.batch_number}</b><span>{batch.quantity} packs</span><span>Exp {batch.expiry_date}</span><span>MRP {money(batch.mrp)}</span></div>)}
        </div>)}
        <TaxBreakdown value={order} />
      </Card>
      <div className="detail-columns">
        <Card className="inset"><h3>Delivery information</h3><p>{order.address}</p><p>Partner: {driver?.name ?? 'Not yet assigned'}</p>{latest && <p>Last location: <b>{latest.latitude.toFixed(5)}, {latest.longitude.toFixed(5)}</b><br />{dateTime(latest.at)}</p>}</Card>
        <Card className="inset"><h3>Order timeline</h3><Timeline entries={order.history} /></Card>
      </div>
      <div className="order-actions">
        {canManage && order.status === 'placed' && <Button onClick={() => statusMutation.mutate({ status: 'confirmed' })}>Confirm order</Button>}
        {canManage && order.status === 'confirmed' && <Button onClick={() => statusMutation.mutate({ status: 'packed' })}>Mark as packed</Button>}
        {canManage && order.status === 'packed' && <div className="inline-form"><select value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Select delivery partner</option>{drivers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><Button disabled={!driverId} onClick={() => statusMutation.mutate({ status: 'out_for_delivery', driver_id: driverId })}>Assign & dispatch</Button></div>}
        {(user?.role === 'admin' || user?.role === 'delivery') && order.status === 'out_for_delivery' && <Button onClick={() => statusMutation.mutate({ status: 'delivered' })}>Complete delivery</Button>}
        {canCancel && <Button variant="danger" onClick={() => setConfirmCancel(true)}>Cancel order</Button>}
      </div>
      {confirmCancel && <Card className="inset"><h3>Cancel {order.number}?</h3><Notice tone="amber">This releases reserved stock and trade credit. The order cannot be reopened.</Notice><div className="modal-actions"><Button variant="secondary" onClick={() => setConfirmCancel(false)}>Keep order</Button><Button variant="danger" onClick={() => statusMutation.mutate({ status: 'cancelled' })}>Confirm cancellation</Button></div></Card>}
      {user?.role === 'delivery' && order.status === 'out_for_delivery' && <Card className="inset"><h3>Share location</h3><Notice>Location is shared only when you submit it.</Notice><div className="inline-form"><Button variant="secondary" type="button" onClick={locate}><MapPin /> Use current location</Button><input type="number" step="any" placeholder="Latitude" value={coordinates.latitude} onChange={(event) => setCoordinates({ ...coordinates, latitude: event.target.value })} /><input type="number" step="any" placeholder="Longitude" value={coordinates.longitude} onChange={(event) => setCoordinates({ ...coordinates, longitude: event.target.value })} /><Button disabled={!coordinates.latitude || !coordinates.longitude} onClick={() => trackingMutation.mutate()}><MapPin /> Share</Button></div></Card>}
      {user && ['admin', 'distributor', 'delivery'].includes(user.role) && order.status === 'delivered' && order.payment_status === 'unpaid' && <Card className="inset"><h3>Record offline payment</h3><Notice tone="amber">Record only after the full {money(order.total)} has been received outside the portal.</Notice><div className="inline-form"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Receipt / transaction reference" /><Button disabled={!reference} onClick={() => paymentMutation.mutate()}>Confirm payment</Button></div></Card>}
    </Modal>
  )
}

export function Dashboard() {
  const state = useAppState()
  const { user } = useAuth()
  const [selected, setSelected] = useState<Order | null>(null)
  const valid = state.orders.filter((order) => order.status !== 'cancelled')
  const active = valid.filter((order) => order.status !== 'delivered')
  const low = state.products.filter((product) => product.active && product.stock <= product.reorder)
  const total = valid.reduce((sum, order) => sum + order.total, 0)
  const firstName = user?.name.split(' ')[0] ?? 'there'
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
    return { label: day.label, value, formattedValue: money(value) }
  })
  return <>
    <PageHeader title={`Good ${greetingPeriod}, ${firstName}`} subtitle="Here’s what’s happening across your workspace." eyebrow={user?.business} />
    <section className="hero">
      <div><div className="eyebrow">A clearer view. A better day.</div><h2>{user?.role === 'retailer' ? 'Your pharmacy restock starts here.' : user?.role === 'delivery' ? 'Every delivery makes a difference.' : 'Your supply chain, working together.'}</h2><p>Bring orders, inventory, and fulfilment into one connected workspace.</p></div>
      <div className="hero-symbols"><Package /><ArrowRight /><Truck /><ArrowRight /><CheckCircle2 /></div>
    </section>
    <div className="stats">
      <Stat title="Total order value" value={money(total)} note="Excludes cancelled orders" icon={<WalletCards />} />
      <Stat title="Active orders" value={active.length} note="Moving through the supply chain" icon={<ClipboardList />} />
      <Stat title={user?.role === 'retailer' ? 'Available credit' : 'Low-stock products'} value={user?.role === 'retailer' ? money((state.user.credit_limit || 0) - (state.user.credit_used || 0)) : low.length} note="Live workspace data" icon={<Package />} />
      <Stat title="Completed orders" value={valid.filter((order) => order.status === 'delivered').length} note="Successfully delivered" icon={<CheckCircle2 />} />
    </div>
    <Card className="chart-card"><div className="card-head"><div><h2>Order activity</h2><p>Order value over the last 7 days</p></div><strong>{money(chartData.reduce((sum, datum) => sum + datum.value, 0))}</strong></div><div className="card-body"><BarChart data={chartData} ariaLabel="Seven-day order values" /></div></Card>
    <div className="grid-two">
      <Card><div className="card-head"><div><h2>Recent orders</h2><p>Your latest business activity</p></div></div><OrderTable orders={[...state.orders].reverse().slice(0, 5)} role={user?.role} onView={setSelected} /></Card>
      <Card><div className="card-head"><div><h2>{low.length ? 'Inventory attention' : 'Workspace status'}</h2><p>Live operational signals</p></div></div><div className="card-body">{low.slice(0, 5).map((product) => <div className="activity" key={product.id}><Package /><div><b>{product.name}</b><small>{product.stock} packs · reorder at {product.reorder}</small></div></div>)}{!low.length && <Empty title="Everything looks healthy">No stock items need attention.</Empty>}</div></Card>
    </div>
    {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
  </>
}

function Cart({
  cart,
  setCart,
  close,
}: {
  cart: Record<string, number>
  setCart: (cart: Record<string, number>) => void
  close: () => void
}) {
  const state = useAppState()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [address, setAddress] = useState(state.user.address || '')
  const [supplyState, setSupplyState] = useState(state.user.state_code || '29')
  const [method, setMethod] = useState<'cod' | 'credit'>('cod')
  const orderKey = useRef(createIdempotencyKey())
  const items = cartItems(cart)
  const quote = useQuery({ queryKey: ['quote', items, supplyState], queryFn: () => api.quote(buildQuoteRequest(cart, supplyState)), enabled: items.length > 0 })
  const checkout = useMutation({
    mutationFn: () => api.createOrder(buildOrderRequest(cart, address, method, supplyState, quote.data!.total), orderKey.current),
    onSuccess: async (order) => {
      setCart({})
      await queryClient.invalidateQueries({ queryKey: ['state'] })
      toast(`Order ${order.number} placed.`)
      close()
    },
    onError: (error) => toast(error.message, 'error'),
  })
  const change = (id: string, delta: number) => {
    const product = state.products.find((item) => item.id === id)
    const next = (cart[id] || 0) + delta
    if (product && next > product.stock) return toast(`Only ${product.stock} packs are available.`, 'error')
    const updated = { ...cart }
    if (next <= 0) delete updated[id]
    else updated[id] = next
    setCart(updated)
    orderKey.current = createIdempotencyKey()
  }
  return <Modal title="Review your medicine order" subtitle="Batch allocation and tax are checked by the server." onClose={close} wide>
    {!items.length ? <Empty title="Your order is empty">Add medicines from the catalog to start a new order.</Empty> : <>
      {quote.isLoading && <p>Calculating current stock and tax…</p>}
      {quote.error && <Notice tone="amber">{quote.error.message}</Notice>}
      {quote.data && <>
        {quote.data.lines.map((line) => <div className="cart-line" key={line.product_id}><div><strong>{line.name}</strong><small>{line.unit} · HSN {line.hsn_code} · GST {line.gst_rate_bps! / 100}%</small></div><QuantityStepper value={line.quantity} label={line.name} onDecrement={() => change(line.product_id, -1)} onIncrement={() => change(line.product_id, 1)} /><strong>{money(line.total)}</strong></div>)}
        <Card className="inset"><TaxBreakdown value={quote.data} /></Card>
        <div className="form-grid">
          <label className="full">Delivery address<textarea value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label>Place of supply<StateSelect value={supplyState} onChange={(value) => { setSupplyState(value); orderKey.current = createIdempotencyKey() }} /></label>
          <label>Payment terms<select value={method} onChange={(event) => setMethod(event.target.value as 'cod' | 'credit')}><option value="cod">Cash on delivery</option><option value="credit">Trade credit</option></select></label>
        </div>
        <div className="modal-actions"><Button variant="secondary" onClick={close}>Cancel</Button><Button disabled={!address || checkout.isPending} onClick={() => checkout.mutate()}>Place order · {money(quote.data.total)}</Button></div>
      </>}
    </>}
  </Modal>
}

export function Catalog() {
  const state = useAppState()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [showCart, setShowCart] = useState(false)
  const [details, setDetails] = useState<Product | null>(null)
  const toast = useToast()
  const categories = ['all', ...new Set(state.products.filter((product) => product.active).map((product) => product.category))]
  const products = state.products.filter((product) => product.active && (category === 'all' || product.category === category) && `${product.name} ${product.sku} ${product.brand} ${product.category} ${product.strength || ''}`.toLowerCase().includes(query.toLowerCase()))
  const count = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0)
  const add = (product: Product) => {
    const next = (cart[product.id] || 0) + 1
    if (next > product.stock) return toast(`Only ${product.stock} packs are available.`, 'error')
    setCart({ ...cart, [product.id]: next })
    toast(`${product.name} added to order.`)
  }
  return <>
    <PageHeader title="Medicine catalog" subtitle="Generic medicines. Clear stock visibility. Connected distribution." eyebrow={state.user.business} actions={<Button onClick={() => setShowCart(true)}><ShoppingCart /> View order{count ? ` · ${count}` : ''}</Button>} />
    <Notice>India medicine catalog · Seeded prices, pack sizes, and stock are demo trade data.</Notice>
    <div className="toolbar"><div className="actions"><b>{state.products.filter((product) => product.active).length} medicines</b><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{value === 'all' ? 'All categories' : value}</option>)}</select></div><SearchInput value={query} onChange={setQuery} placeholder="Search medicine, strength or SKU" /></div>
    {products.length ? <div className="catalog-grid">{products.map((product) => <ProductCard key={product.id} product={product} quantity={cart[product.id] || 0} onAdd={() => add(product)} onDetails={() => setDetails(product)} />)}</div> : <Card><Empty title="No matching medicines">Try a different name, strength, or category.</Empty></Card>}
    {showCart && <Cart cart={cart} setCart={setCart} close={() => setShowCart(false)} />}
    {details && <Modal title="Batches & medicine details" subtitle={details.name} onClose={() => setDetails(null)} wide><ProductFacts product={details} /><Notice>Stock is reserved by earliest expiry. Expired and quarantined packs are excluded from ordering.</Notice><BatchTable batches={details.batches || []} /></Modal>}
  </>
}

export function Orders() {
  const state = useAppState()
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

export function Deliveries() {
  const state = useAppState()
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

export function Payments() {
  const state = useAppState()
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

export function Credit() {
  const state = useAppState()
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<string | null>(null)
  const [limit, setLimit] = useState('')
  const retailers = useMemo(() => user?.role === 'retailer' ? [state.user] : state.users.filter((person) => person.role === 'retailer'), [state, user])
  const save = useMutation({
    mutationFn: ({ id, credit_limit }: { id: string; credit_limit: number }) =>
      api.updateUser({ id, credit_limit }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); setEditing(null); toast('Credit limit updated.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Trade credit" subtitle="Manage purchasing capacity and outstanding balances." eyebrow={state.user.business} />
    <Notice>Trade credit is reserved when an order is placed and released after payment or cancellation.</Notice>
    <div className="credit-grid">{retailers.map((retailer) => {
      const creditLimit = retailer.credit_limit || 0
      const creditUsed = retailer.credit_used || 0
      const available = creditLimit - creditUsed
      return <Card key={retailer.id}><div className="card-head"><div><h2>{retailer.business}</h2><p>{retailer.name}</p></div>{user?.role === 'admin' && <Button variant="secondary" onClick={() => { setEditing(retailer.id); setLimit(String(creditLimit / 100)) }}>Edit limit</Button>}</div><div className="card-body"><small>AVAILABLE PURCHASING CREDIT</small><div className="credit-amount">{money(available)}</div><CreditMeter used={creditUsed} limit={creditLimit} /><DetailPair label="Approved limit" value={<strong>{money(creditLimit)}</strong>} /><DetailPair label="Outstanding" value={<strong>{money(creditUsed)}</strong>} /></div></Card>
    })}</div>
    {editing && <Modal title="Update trade credit limit" onClose={() => setEditing(null)}><label>Approved limit (₹)<input type="number" min={(retailers.find((person) => person.id === editing)?.credit_used || 0) / 100} step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} /></label><div className="modal-actions"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => save.mutate({ id: editing, credit_limit: Math.round(Number(limit) * 100) })}>Save credit limit</Button></div></Modal>}
  </>
}
