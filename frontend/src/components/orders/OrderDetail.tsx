import { updateOrder, reviewReturn } from '../../state/pages/ordersSlice'
import { recordPayment } from '../../state/pages/paymentsSlice'
import { trackDelivery } from '../../state/pages/deliveriesSlice'
import { useAppDispatch } from '../../state/store'
import { useMutation } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import { useRef, useState } from 'react'
import { Badge, Button, Card, DetailPair, Modal, Notice, TaxBreakdown, Timeline } from '..'
import { dateTime, money } from '../../lib/helpers'
import { createIdempotencyKey } from '../../lib/http'
import { useAuth, useToast } from '../../providers/AppProviders'
import { usePageData } from '../../state/pageContext'
import type { Order, OrderStatus } from '../../types'

export function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const state = usePageData<'orders'>()
  const { user } = useAuth()
  const toast = useToast()
  const [driverId, setDriverId] = useState('')
  const [reference, setReference] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [coordinates, setCoordinates] = useState({ latitude: '', longitude: '' })
  const [confirmCancel, setConfirmCancel] = useState(false)
  const paymentKey = useRef(createIdempotencyKey())
  const refresh = async (message: string) => {
    toast(message)
    onClose()
  }
  const statusMutation = useMutation({
    mutationFn: (body: { status: OrderStatus; driver_id?: string }) => dispatch(updateOrder({ id: order.id, body: body })).unwrap(),
    onSuccess: () => void refresh('Order updated.'),
    onError: (error) => toast(error.message, 'error'),
  })
  const paymentMutation = useMutation({
    mutationFn: () => dispatch(recordPayment({ body: { order_id: order.id, amount: order.total, reference }, key: paymentKey.current })).unwrap(),
    onSuccess: () => void refresh('Offline payment recorded.'),
    onError: (error) => toast(error.message, 'error'),
  })
  const trackingMutation = useMutation({
    mutationFn: () => dispatch(trackDelivery({ order_id: order.id, latitude: Number(coordinates.latitude), longitude: Number(coordinates.longitude) })).unwrap(),
    onSuccess: () => void refresh('Delivery location shared.'),
    onError: (error) => toast(error.message, 'error'),
  })
  const returnMutation = useMutation({
    mutationFn: (action: 'approve' | 'reject') => dispatch(reviewReturn({ order_id: order.id, action, review_note: reviewNote.trim() })).unwrap(),
    onSuccess: () => void refresh('Return request reviewed.'),
    onError: (error) => toast(error.message, 'error'),
  })
  const canManage = user?.role === 'admin' || user?.role === 'distributor'
  const canCancel = Boolean(
    user && ['admin', 'distributor', 'retailer'].includes(user.role) &&
    (['placed', 'confirmed'].includes(order.status) || (canManage && order.status === 'packed')) &&
    order.payment_status === 'unpaid',
  )
  const drivers = (state?.users ?? []).filter((person) => person.role === 'delivery' && person.active)
  const driver = (state?.users ?? []).find((person) => person.id === order.driver_id)
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
      {order.proof_of_delivery && <Card className="inset"><h3>Proof of delivery</h3><p>Signed by {order.proof_of_delivery.recipient_name} on {dateTime(order.proof_of_delivery.captured_at)}.</p><svg viewBox="0 0 1000 1000" role="img" aria-label="Recipient signature" style={{ width: '100%', maxWidth: 360, height: 128, border: '1px solid #e5e8e3', borderRadius: 12, background: '#fff' }} preserveAspectRatio="none">{order.proof_of_delivery.signature.map((stroke, index) => <polyline key={index} points={stroke.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#173d34" strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />)}</svg></Card>}
      {order.return_request && <Card className="inset"><h3>Return request</h3><p><Badge value={order.return_request.status} /> Requested {dateTime(order.return_request.requested_at)}</p><p>{order.return_request.reason}</p>{order.return_request.review_note && <p>Review: {order.return_request.review_note}</p>}{canManage && order.return_request.status === 'requested' && <><Notice tone="amber">Approval records the decision only. Stock, payment, refunds and credit notes require separate handling.</Notice><div className="inline-form"><input aria-label="Return review note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Reason for your decision" maxLength={500} /><Button disabled={!reviewNote.trim() || returnMutation.isPending} onClick={() => returnMutation.mutate('approve')}>Approve request</Button><Button variant="danger" disabled={!reviewNote.trim() || returnMutation.isPending} onClick={() => returnMutation.mutate('reject')}>Reject request</Button></div></>}</Card>}
      <div className="order-actions">
        {canManage && order.status === 'placed' && <Button disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'confirmed' })}>Confirm order</Button>}
        {canManage && order.status === 'confirmed' && <Button disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'packed' })}>Mark as packed</Button>}
        {canManage && order.status === 'packed' && <div className="inline-form"><select value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">Select delivery partner</option>{drivers.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select><Button disabled={!driverId || statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'out_for_delivery', driver_id: driverId })}>Assign & dispatch</Button></div>}
        {(user?.role === 'admin' || user?.role === 'delivery') && order.status === 'out_for_delivery' && <Button disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'delivered' })}>Complete delivery</Button>}
        {canCancel && <Button variant="danger" disabled={statusMutation.isPending} onClick={() => setConfirmCancel(true)}>Cancel order</Button>}
      </div>
      {confirmCancel && <Card className="inset"><h3>Cancel {order.number}?</h3><Notice tone="amber">This releases reserved stock and trade credit. The order cannot be reopened.</Notice><div className="modal-actions"><Button variant="secondary" onClick={() => setConfirmCancel(false)}>Keep order</Button><Button variant="danger" disabled={statusMutation.isPending} onClick={() => statusMutation.mutate({ status: 'cancelled' })}>Confirm cancellation</Button></div></Card>}
      {user?.role === 'delivery' && order.status === 'out_for_delivery' && <Card className="inset"><h3>Share location</h3><Notice>Location is shared only when you submit it.</Notice><div className="inline-form"><Button variant="secondary" type="button" onClick={locate}><MapPin /> Use current location</Button><input type="number" step="any" placeholder="Latitude" value={coordinates.latitude} onChange={(event) => setCoordinates({ ...coordinates, latitude: event.target.value })} /><input type="number" step="any" placeholder="Longitude" value={coordinates.longitude} onChange={(event) => setCoordinates({ ...coordinates, longitude: event.target.value })} /><Button disabled={!coordinates.latitude || !coordinates.longitude || trackingMutation.isPending} onClick={() => trackingMutation.mutate()}><MapPin /> Share</Button></div></Card>}
      {user && ['admin', 'distributor', 'delivery'].includes(user.role) && order.status === 'delivered' && order.payment_status === 'unpaid' && <Card className="inset"><h3>Record offline payment</h3><Notice tone="amber">Record only after the full {money(order.total)} has been received outside the portal.</Notice><div className="inline-form"><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Receipt / transaction reference" /><Button disabled={!reference || paymentMutation.isPending} onClick={() => paymentMutation.mutate()}>Confirm payment</Button></div></Card>}
    </Modal>
  )
}
