import { setBatchQuarantine, adjustStock } from '../../state/pages/inventorySlice'
import { useAppDispatch } from '../../state/store'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Notice } from '..'
import { useToast } from '../../providers/AppProviders'
import type { Batch, Product } from '../../types'

export function BatchActionForm({ product, batch, quarantine, onClose }: { product: Product; batch: Batch; quarantine: boolean; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const toast = useToast()
  const [stockAdjustment, setStockAdjustment] = useState('')
  const [reason, setReason] = useState('')
  const mutation = useMutation({
    mutationFn: () => quarantine
      ? dispatch(setBatchQuarantine({ product_id: product.id, batch_id: batch.id, quarantined: !batch.quarantined, reason })).unwrap()
      : dispatch(adjustStock({ product_id: product.id, batch_id: batch.id, change: Number(stockAdjustment), reason })).unwrap(),
    onSuccess: async () => { toast(quarantine ? 'Batch status updated.' : 'Stock adjustment saved.'); onClose() },
    onError: (error) => toast(error.message, 'error'),
  })
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <Notice>Current unreserved stock: <strong>{batch.stock} packs</strong>.</Notice>
    {!quarantine && <label>Stock change<input required min="-100000" max="100000" step="1" type="number" value={stockAdjustment} onChange={(event) => setStockAdjustment(event.target.value)} /></label>}
    <label>Reason<textarea required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{quarantine ? (batch.quarantined ? 'Release batch' : 'Quarantine batch') : 'Save adjustment'}</Button></div>
  </form>
}
