import { Archive, Clock, Package, Plus, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Button, Card, Empty, Modal, PageHeader, SearchInput, Stat, Tabs } from '../components'
import { BatchActionForm } from '../components/inventory/BatchActionForm'
import { BatchList } from '../components/inventory/BatchList'
import { ProductForm } from '../components/inventory/ProductForm'
import { ReceiveBatchForm } from '../components/inventory/ReceiveBatchForm'
import type { Dialog } from '../components/inventory/types'
import { money } from '../lib/helpers'
import { usePageData } from '../state/pageContext'

type InventoryFilter = 'all' | 'low' | 'expiry' | 'archived'

export function Inventory() {
  const state = usePageData<'inventory'>()
  const [filter, setFilter] = useState<InventoryFilter>('all')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const products = state.products.filter((product) => {
    const filterMatch = filter === 'archived' ? !product.active : product.active &&
      (filter !== 'low' || product.stock <= product.reorder) &&
      (filter !== 'expiry' || Boolean(product.near_expiry_stock || product.expired_stock))
    return filterMatch && `${product.name} ${product.sku} ${product.manufacturer || ''} ${product.hsn_code || ''} ${(product.batches || []).map((batch) => batch.batch_number).join(' ')}`.toLowerCase().includes(query.toLowerCase())
  })
  const active = state.products.filter((product) => product.active)
  return <>
    <PageHeader title="Medicines & inventory" subtitle="Batch traceability, expiry visibility, and medicine tax details." eyebrow={state.user.business} actions={<Button onClick={() => setDialog({ kind: 'product' })}><Plus /> Add medicine</Button>} />
    <div className="stats">
      <Stat title="Available stock" value={active.reduce((sum, product) => sum + product.stock, 0)} note="Released trade packs" icon={<Package />} />
      <Stat title="Expiring in 90 days" value={active.reduce((sum, product) => sum + (product.near_expiry_stock || 0), 0)} note="Packs requiring attention" icon={<Clock />} />
      <Stat title="Expired stock" value={active.reduce((sum, product) => sum + (product.expired_stock || 0), 0)} note="Blocked from dispatch" icon={<Archive />} />
      <Stat title="Quarantined stock" value={active.reduce((sum, product) => sum + (product.quarantined_stock || 0), 0)} note="Held for review" icon={<ShieldAlert />} />
    </div>
    <div className="toolbar"><Tabs value={filter} options={[{ value: 'all', label: 'Active medicines' }, { value: 'low', label: 'Stock attention' }, { value: 'expiry', label: 'Expiry attention' }, { value: 'archived', label: 'Archived' }]} onChange={setFilter} /><SearchInput value={query} onChange={setQuery} placeholder="Search medicine, batch ID or HSN" /></div>
    <Card>{products.length ? <div className="table-wrap"><table><thead><tr><th>Medicine / manufacturer</th><th>HSN / GST</th><th>Sell price</th><th>Available packs</th><th>Next expiry</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.sku} · {product.unit}</small><small>{product.manufacturer || 'Not configured'}</small></td><td><strong>{product.hsn_code || '—'}</strong><small>GST {product.gst_rate_bps === undefined ? '—' : `${product.gst_rate_bps / 100}%`}</small></td><td><strong>{money(product.price)}</strong></td><td><strong>{product.stock}</strong><small>{product.batches?.length || 0} batches · reorder {product.reorder}</small></td><td>{product.next_expiry || '—'}</td><td><div className="actions"><Button variant="secondary" onClick={() => setDialog({ kind: 'batches', product })}>Batches</Button><Button variant="ghost" onClick={() => setDialog({ kind: 'product', product })}>Edit</Button></div></td></tr>)}</tbody></table></div> : <Empty title="No matching medicines">Try another medicine, batch ID, or filter.</Empty>}</Card>
    {dialog?.kind === 'product' &&
      <Modal
        title={dialog.product ? 'Edit medicine' : 'Add a medicine'}
        subtitle={dialog.product?.sku || 'Create the medicine, then receive batch stock.'}
        onClose={() => setDialog(null)} wide>
        <ProductForm product={dialog.product} state={state} close={() => setDialog(null)} onCreated={(product) => setDialog({ kind: 'receive', product })} />
      </Modal>}
    {dialog?.kind === 'batches' && <BatchList product={dialog.product} open={setDialog} close={() => setDialog(null)} />}
    {dialog?.kind === 'receive' && <Modal title="Receive a medicine batch" subtitle={dialog.product.name} onClose={() => setDialog(null)}><ReceiveBatchForm product={dialog.product} close={() => setDialog(null)} /></Modal>}
    {dialog?.kind === 'stock' && <Modal title="Adjust batch stock" subtitle={`${dialog.product.name} · ${dialog.batch.batch_number}`} onClose={() => setDialog(null)}><BatchActionForm product={dialog.product} batch={dialog.batch} quarantine={false} close={() => setDialog(null)} /></Modal>}
    {dialog?.kind === 'quarantine' && <Modal title={dialog.batch.quarantined ? 'Release a batch' : 'Quarantine a batch'} subtitle={`${dialog.product.name} · ${dialog.batch.batch_number}`} onClose={() => setDialog(null)}><BatchActionForm product={dialog.product} batch={dialog.batch} quarantine close={() => setDialog(null)} /></Modal>}
  </>
}
