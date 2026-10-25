import { setBatchQuarantine, adjustStock } from '../../state/pages/inventorySlice'
import { useAppDispatch } from '../../state/store'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Notice } from '..'
import { useToast } from '../../providers/AppProviders'
import type { Batch, Product } from '../../types'

export function BatchActionForm({ product, batch, quarantine, close }: { product: Product; batch: Batch; quarantine: boolean; close: () => void }) {
  const dispatch = useAppDispatch()
  const toast = useToast()
  const [change, setChange] = useState('')
  const [reason, setReason] = useState('')
  const mutation = useMutation({
    mutationFn: () => quarantine
      ? dispatch(setBatchQuarantine({ product_id: product.id, batch_id: batch.id, quarantined: !batch.quarantined, reason })).unwrap()
      : dispatch(adjustStock({ product_id: product.id, batch_id: batch.id, change: Number(change), reason })).unwrap(),
    onSuccess: async () => { toast(quarantine ? 'Batch status updated.' : 'Stock adjustment saved.'); close() },
    onError: (error) => toast(error.message, 'error'),
  })
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <Notice>Current unreserved stock: <strong>{batch.stock} packs</strong>.</Notice>
    {!quarantine && <label>Stock change<input required min="-100000" max="100000" step="1" type="number" value={change} onChange={(event) => setChange(event.target.value)} /></label>}
    <label>Reason<textarea required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{quarantine ? (batch.quarantined ? 'Release batch' : 'Quarantine batch') : 'Save adjustment'}</Button></div>
  </form>
}
