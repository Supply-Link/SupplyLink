import { loadQuote } from '../../state/pages/catalogSlice'
import { createOrder } from '../../state/pages/ordersSlice'
import { useAppDispatch } from '../../state/store'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Button, Card, Empty, Modal, Notice, QuantityStepper, StateSelect, TaxBreakdown } from '..'
import { buildOrderRequest, buildQuoteRequest, cartItems } from '../../lib/checkout'
import { money } from '../../lib/helpers'
import { createIdempotencyKey } from '../../lib/http'
import { useToast } from '../../providers/AppProviders'
import { usePageData } from '../../state/pageContext'

export function Cart({
  cart,
  setCart,
  close,
}: {
  cart: Record<string, number>
  setCart: (cart: Record<string, number>) => void
  close: () => void
}) {
  const dispatch = useAppDispatch()
  const state = usePageData<'catalog'>()
  const toast = useToast()
  const [address, setAddress] = useState(state.user.address || '')
  const [supplyState, setSupplyState] = useState(state.user.state_code || '29')
  const [method, setMethod] = useState<'cod' | 'credit'>('cod')
  const orderKey = useRef(createIdempotencyKey())
  const items = cartItems(cart)
  const quote = useQuery({ queryKey: ['quote', items, supplyState], queryFn: () => dispatch(loadQuote(buildQuoteRequest(cart, supplyState))).unwrap(), enabled: items.length > 0 })
  const checkout = useMutation({
    mutationFn: () => dispatch(createOrder({ body: buildOrderRequest(cart, address, method, supplyState, quote.data!.total), key: orderKey.current })).unwrap(),
    onSuccess: async (order) => {
      setCart({})
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
      {quote.isLoading && <div className="skeleton-card" aria-label="Calculating current stock and tax" aria-busy="true"><div className="skeleton-line" /><div className="skeleton-line skeleton-short" /><div className="skeleton-line skeleton-tiny" /></div>}
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
