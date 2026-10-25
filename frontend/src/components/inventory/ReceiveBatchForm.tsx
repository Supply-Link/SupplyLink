import { receiveBatch } from '../../state/pages/inventorySlice'
import { useAppDispatch } from '../../state/store'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Notice } from '..'
import { useToast } from '../../providers/AppProviders'
import type { Product } from '../../types'

export function ReceiveBatchForm({ product, close }: { product: Product; close: () => void }) {
  const dispatch = useAppDispatch()
  const toast = useToast()
  const [values, setValues] = useState({ batch_number: '', manufacturing_date: '', expiry_date: '', stock: '', mrp: '', purchase_price: '', source: 'new' })
  const set = (name: keyof typeof values, value: string) => setValues((current) => ({ ...current, [name]: value }))
  const mutation = useMutation({
    mutationFn: () => dispatch(receiveBatch({
      product_id: product.id,
      batch_number: values.batch_number,
      manufacturing_date: values.manufacturing_date,
      expiry_date: values.expiry_date,
      stock: Number(values.stock),
      mrp: Math.round(Number(values.mrp) * 100),
      purchase_price: Math.round(Number(values.purchase_price) * 100),
      source: values.source as 'new' | 'unallocated',
    })).unwrap(),
    onSuccess: async () => { toast('Batch received.'); close() },
    onError: (error) => toast(error.message, 'error'),
  })
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <Notice>Record dates and prices from the actual pack label.</Notice>
    <div className="form-grid">
      <label>Batch ID / lot number<input required maxLength={60} value={values.batch_number} onChange={(event) => set('batch_number', event.target.value)} /></label>
      <label>Manufacturing date<input required type="date" value={values.manufacturing_date} onChange={(event) => set('manufacturing_date', event.target.value)} /></label>
      <label>Expiry date<input required type="date" value={values.expiry_date} onChange={(event) => set('expiry_date', event.target.value)} /></label>
      <label>Received quantity<input required min="1" step="1" type="number" value={values.stock} onChange={(event) => set('stock', event.target.value)} /></label>
      <label>MRP incl. GST (₹)<input required min=".01" step=".01" type="number" value={values.mrp} onChange={(event) => set('mrp', event.target.value)} /></label>
      <label>Purchase price excl. GST (₹)<input required min="0" step=".01" type="number" value={values.purchase_price} onChange={(event) => set('purchase_price', event.target.value)} /></label>
      {Boolean(product.unallocated_stock) && <label>Stock source<select value={values.source} onChange={(event) => set('source', event.target.value)}><option value="new">New receipt</option><option value="unallocated">Allocate historical stock ({product.unallocated_stock} packs)</option></select></label>}
    </div>
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>Receive batch</Button></div>
  </form>
}
