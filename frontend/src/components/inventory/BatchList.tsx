import { Plus } from 'lucide-react'
import { BatchTable, Button, Modal, Notice, ProductFacts } from '..'
import type { Product } from '../../types'
import type { Dialog } from './types'

export function BatchList({ product, open, close }: { product: Product; open: (dialog: Dialog) => void; close: () => void }) {
  return <Modal title="Batches & medicine details" subtitle={product.name} onClose={close} wide>
    <ProductFacts product={product} />
    <Notice>Expired and quarantined packs are excluded from ordering. Stock is reserved by earliest expiry.</Notice>
    <BatchTable batches={product.batches || []} showCost actions={(batch) => <div className="actions"><Button variant="secondary" onClick={() => open({ kind: 'stock', product, batch })}>Adjust</Button><Button variant="ghost" onClick={() => open({ kind: 'quarantine', product, batch })}>{batch.quarantined ? 'Release' : 'Hold'}</Button></div>} />
    <div className="modal-actions"><Button onClick={() => open({ kind: 'receive', product })}><Plus /> Receive batch</Button></div>
  </Modal>
}
