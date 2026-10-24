import { ArrowRight, Package, Plus } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import type { Batch, Product, Role } from '../../api/types'
import { ROLE_NAMES, STATE_NAMES } from '../../lib/constants'
import { money } from '../../lib/helpers'
import {
  Badge, Card, DataTable, ProgressBar, Select, type DataTableColumn,
} from '../ui'

export function ProductCard({
  product,
  quantity,
  onAdd,
  onDetails,
}: {
  product: Product
  quantity: number
  onAdd: () => void
  onDetails: () => void
}) {
  const stockLabel = product.stock === 0 ? 'Out of stock' : product.stock <= product.reorder ? 'Low stock' : 'In stock'
  return <Card className="product-card">
    <div className="product-art" style={{ background: /^#[\da-f]{6}$/i.test(product.color) ? product.color : '#eef2e7' }}>
      <Badge value={stockLabel} tone={product.stock === 0 ? 'red' : product.stock <= product.reorder ? 'amber' : 'green'} />
      <div className={`medicine-pack ${product.art}`}><Package /><small>SUPPLYLINK GENERIC</small><strong>{product.generic_name || product.name}</strong><span>{product.strength || product.dosage_form}</span></div>
    </div>
    <div className="product-body"><small>{product.category} · {product.dosage_form || 'Medicine'}</small><h3>{product.name}</h3><p>{product.unit}</p><div className="stock-row"><span>{product.stock} packs available</span><span>{product.sku}</span></div><div className="price-row"><strong>{money(product.price)}<small>per pack · excl. GST</small></strong><button aria-label={`Add ${product.name} to order`} disabled={product.stock < 1} onClick={onAdd}>{quantity || <Plus />}</button></div><button className="product-details-link" onClick={onDetails}>View batches & medicine details <ArrowRight /></button></div>
  </Card>
}

export function BatchTable({
  batches,
  showCost = false,
  actions,
}: {
  batches: readonly Batch[]
  showCost?: boolean
  actions?: (batch: Batch) => ReactNode
}) {
  const columns: DataTableColumn<Batch>[] = [
    { key: 'batch', header: 'Batch ID', render: (batch) => <strong>{batch.batch_number}</strong> },
    { key: 'dates', header: 'Mfg / expiry', render: (batch) => <>{batch.manufacturing_date}<small>Exp {batch.expiry_date}</small></> },
    { key: 'stock', header: 'Stock', render: (batch) => <><strong>{batch.stock} packs</strong>{showCost && <small>Cost {money(batch.purchase_price)}</small>}</> },
    { key: 'mrp', header: 'MRP incl. GST', render: (batch) => money(batch.mrp) },
    { key: 'status', header: 'Status', render: (batch) => <Badge value={batch.status} /> },
  ]
  if (actions) columns.push({ key: 'actions', header: 'Actions', render: actions })
  return <DataTable rows={batches} columns={columns} rowKey={(batch) => batch.id} emptyTitle="No batches available" emptyMessage="Receive a batch to make this medicine orderable." />
}

export function CreditMeter({ used, limit }: { used: number; limit: number }) {
  return <ProgressBar value={used} max={limit} label={`${money(used)} of ${money(limit)} credit used`} />
}

export function StateSelect({
  value,
  onChange,
  ...props
}: Omit<ComponentPropsWithoutRef<'select'>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}) {
  return <Select value={value} onChange={(event) => onChange(event.target.value)} {...props}>{Object.entries(STATE_NAMES).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}</Select>
}

export function RoleBadge({ role }: { role: Role }) {
  return <Badge value={ROLE_NAMES[role]} />
}

export function ProductFacts({ product }: { product: Product }) {
  return <div className="facts-grid"><div><small>Manufacturer</small><strong>{product.manufacturer || 'Not configured'}</strong></div><div><small>HSN · GST</small><strong>{product.hsn_code || '—'} · {product.gst_rate_bps === undefined ? '—' : `${product.gst_rate_bps / 100}%`}</strong></div><div><small>Sell price excl. GST</small><strong>{money(product.price)} / pack</strong></div><div><small>Storage</small><strong>{product.storage_conditions || 'Follow label'}</strong></div></div>
}
