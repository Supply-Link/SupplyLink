import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Archive, Clock, Package, Plus, ShieldAlert } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { useOutletContext } from 'react-router-dom'
import { api } from '../state/actions'
import type { AppState, Batch, Product, ProductInput } from '../api/types'
import { money } from '../lib/helpers'
import { useAuth, useToast } from '../providers/AppProviders'
import {
  BatchTable, Button, Card, Empty, Modal, Notice, PageHeader, ProductFacts,
  SearchInput, Stat, Tabs,
} from '../components'

type InventoryFilter = 'all' | 'low' | 'expiry' | 'archived'
type Dialog =
  | { kind: 'product'; product?: Product }
  | { kind: 'batches'; product: Product }
  | { kind: 'receive'; product: Product }
  | { kind: 'stock'; product: Product; batch: Batch }
  | { kind: 'quarantine'; product: Product; batch: Batch }
  | null

function ProductForm({
  product,
  state,
  close,
  onCreated,
}: {
  product?: Product
  state: AppState
  close: () => void
  onCreated: (product: Product) => void
}) {
  const { user } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const distributors = state.users.filter((person) => person.role === 'distributor' && person.active)
  const [values, setValues] = useState({
    name: product?.name || '',
    brand: product?.brand || 'Generic medicine',
    generic_name: product?.generic_name || product?.name || '',
    strength: product?.strength || '',
    dosage_form: product?.dosage_form || 'Tablets',
    category: product?.category || 'Pain & fever',
    manufacturer: product?.manufacturer || '',
    unit: product?.unit || 'Strip of 10 tablets',
    sku: product?.sku || '',
    price: product ? String(product.price / 100) : '',
    hsn_code: product?.hsn_code || '',
    gst_percent: product?.gst_rate_bps === undefined ? '' : String(product.gst_rate_bps / 100),
    storage_conditions: product?.storage_conditions || 'Follow the manufacturer label',
    reorder: String(product?.reorder ?? 20),
    active: String(product?.active ?? true),
    distributor_id: product?.distributor_id || distributors[0]?.id || '',
  })
  const set = (name: keyof typeof values, value: string) => setValues((current) => ({ ...current, [name]: value }))
  const importFromExcel = async (file: File) => {
    setImporting(true)

    let created = 0
    const errors: string[] = []

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
        raw: false,
      })

      if (!rows.length) {
        throw new Error('The Excel file contains no product rows.')
      }

      // Normalize column headers so "Generic Name" and
      // "generic_name" can map to the same field.
      const normalize = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]/g, '')

      const get = (row: Record<string, unknown>, ...keys: string[]) => {
        const key = Object.keys(row).find((column) =>
          keys.map(normalize).includes(normalize(column)),
        )

        return key === undefined ? '' : String(row[key] ?? '').trim()
      }

      for (let index = 0; index < rows.length; index++) {
        const row = rows[index]
        const rowNumber = index + 2

        try {
          const name = get(row, 'name', 'medicine_name', 'medicine display name')
          const sku = get(row, 'sku')
          const price = Number(get(row, 'price', 'selling_price'))
          const hsn = get(row, 'hsn_code', 'hsn')
          const gst = Number(get(row, 'gst_percent', 'gst_rate', 'gst'))

          if (!name || !sku) {
            throw new Error('Medicine name and SKU are required.')
          }

          if (!Number.isFinite(price) || price <= 0) {
            throw new Error('Selling price must be greater than zero.')
          }

          if (!/^(?:\d{4}|\d{6}|\d{8})$/.test(hsn)) {
            throw new Error('HSN must contain 4, 6, or 8 digits.')
          }

          if (!Number.isFinite(gst) || gst < 0 || gst > 40) {
            throw new Error('GST must be between 0 and 40.')
          }

          const genericName = get(row, 'generic_name', 'generic name') || name

          await api.saveProduct({
            sku,
            stock: 0,
            distributor_id:
              user?.role === 'admin' ? values.distributor_id : undefined,
            name,
            brand: get(row, 'brand') || 'Generic medicine',
            generic_name: genericName,
            strength: get(row, 'strength') || 'Not specified',
            dosage_form: get(row, 'dosage_form', 'dosage form') || 'Tablets',
            category: get(row, 'category') || 'Pain & fever',
            manufacturer: get(row, 'manufacturer'),
            unit: get(row, 'unit', 'pack') || 'Strip of 10 tablets',
            price: Math.round(price * 100),
            hsn_code: hsn,
            gst_rate_bps: Math.round(gst * 100),
            storage_conditions:
              get(row, 'storage_conditions', 'storage conditions') ||
              'Follow the manufacturer label',
            reorder: Number(get(row, 'reorder', 'reorder threshold') || 20),
          })

          created++
        } catch (error) {
          errors.push(
            `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Import failed'
            }`,
          )
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['state'] })

      if (errors.length === 0) {
        toast(`${created} medicines imported successfully.`)
        close()
      } else {
        toast(
          `${created} imported; ${errors.length} failed. Check the row errors below.`,
          'error',
        )
      }

      setImportErrors(errors)
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'Unable to read Excel file.',
        'error',
      )
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }
  const mutation = useMutation({
    mutationFn: (body: ProductInput) => api.saveProduct(body),
    onSuccess: async (savedProduct) => {
      await queryClient.invalidateQueries({ queryKey: ['state'] })
      toast(product ? 'Medicine saved.' : 'Medicine created. Add a batch to make it orderable.')
      if (product) close()
      else onCreated(savedProduct)
    },
    onError: (error) => toast(error.message, 'error'),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    mutation.mutate({
      ...(product ? { id: product.id, active: values.active === 'true' } : {
        sku: values.sku,
        stock: 0,
        distributor_id: user?.role === 'admin' ? values.distributor_id : undefined,
      }),
      name: values.name,
      brand: values.brand,
      generic_name: values.generic_name,
      strength: values.strength,
      dosage_form: values.dosage_form,
      category: values.category,
      manufacturer: values.manufacturer,
      unit: values.unit,
      price: Math.round(Number(values.price) * 100),
      hsn_code: values.hsn_code,
      gst_rate_bps: Math.round(Number(values.gst_percent) * 100),
      storage_conditions: values.storage_conditions,
      reorder: Number(values.reorder),
    })
  }
  return <form onSubmit={submit}>
    <div className="form-grid">
      <label>Medicine display name<input required maxLength={100} value={values.name} onChange={(event) => set('name', event.target.value)} /></label>
      <label>Brand / catalog label<input required maxLength={100} value={values.brand} onChange={(event) => set('brand', event.target.value)} /></label>
      <label>Generic name<input required maxLength={100} value={values.generic_name} onChange={(event) => set('generic_name', event.target.value)} /></label>
      <label>Strength / concentration<input required maxLength={100} value={values.strength} onChange={(event) => set('strength', event.target.value)} /></label>
      <label>Dosage form<input required maxLength={100} value={values.dosage_form} onChange={(event) => set('dosage_form', event.target.value)} /></label>
      <label>Category<input required maxLength={100} value={values.category} onChange={(event) => set('category', event.target.value)} /></label>
      <label>Manufacturer<input required maxLength={150} value={values.manufacturer} onChange={(event) => set('manufacturer', event.target.value)} /></label>
      <label>Pack / unit<input required maxLength={100} value={values.unit} onChange={(event) => set('unit', event.target.value)} /></label>
      {!product && <label>SKU<input required maxLength={40} value={values.sku} onChange={(event) => set('sku', event.target.value)} /></label>}
      <label>Selling price excl. GST (₹)<input required min=".01" step=".01" type="number" value={values.price} onChange={(event) => set('price', event.target.value)} /></label>
      <label>HSN code<input required pattern="[0-9]{4}|[0-9]{6}|[0-9]{8}" maxLength={8} value={values.hsn_code} onChange={(event) => set('hsn_code', event.target.value)} /></label>
      <label>GST rate (%)<input required min="0" max="40" step=".01" type="number" value={values.gst_percent} onChange={(event) => set('gst_percent', event.target.value)} /></label>
      <label className="full">Storage conditions<input required maxLength={300} value={values.storage_conditions} onChange={(event) => set('storage_conditions', event.target.value)} /></label>
      <label>Reorder threshold<input required min="0" step="1" type="number" value={values.reorder} onChange={(event) => set('reorder', event.target.value)} /></label>
      {product && <label>Availability<select value={values.active} onChange={(event) => set('active', event.target.value)}><option value="true">Active — available to order</option><option value="false">Archived — hidden from catalog</option></select></label>}
      {!product && user?.role === 'admin' && <label>Distributor<select required value={values.distributor_id} onChange={(event) => set('distributor_id', event.target.value)}>{distributors.map((person) => <option key={person.id} value={person.id}>{person.business}</option>)}</select></label>}
    </div>
    {!product && (
      <>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importFromExcel(file)
          }}/>
        {importErrors.length > 0 && (
          <div className="full" role="alert">
            <strong>Import errors</strong>
            <ul> {importErrors.map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))} </ul>
          </div>
        )}
      </>
    )}
    <div className="modal-actions">
      <Button type="button" variant="secondary" onClick={close} disabled={importing}>Cancel</Button>
      {!product && (<Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing || mutation.isPending}>{importing ? 'Importing…' : 'Import from Excel'}</Button>)}
      <Button type="submit" disabled={mutation.isPending || importing}>
        {product ? 'Save medicine' : 'Create medicine'}
      </Button>
    </div>
  </form>
}

function ReceiveBatchForm({ product, close }: { product: Product; close: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [values, setValues] = useState({ batch_number: '', manufacturing_date: '', expiry_date: '', stock: '', mrp: '', purchase_price: '', source: 'new' })
  const set = (name: keyof typeof values, value: string) => setValues((current) => ({ ...current, [name]: value }))
  const mutation = useMutation({
    mutationFn: () => api.receiveBatch({
      product_id: product.id,
      batch_number: values.batch_number,
      manufacturing_date: values.manufacturing_date,
      expiry_date: values.expiry_date,
      stock: Number(values.stock),
      mrp: Math.round(Number(values.mrp) * 100),
      purchase_price: Math.round(Number(values.purchase_price) * 100),
      source: values.source as 'new' | 'unallocated',
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast('Batch received.'); close() },
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

function BatchActionForm({ product, batch, quarantine, close }: { product: Product; batch: Batch; quarantine: boolean; close: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [change, setChange] = useState('')
  const [reason, setReason] = useState('')
  const mutation = useMutation({
    mutationFn: () => quarantine
      ? api.setBatchQuarantine({ product_id: product.id, batch_id: batch.id, quarantined: !batch.quarantined, reason })
      : api.adjustStock({ product_id: product.id, batch_id: batch.id, change: Number(change), reason }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast(quarantine ? 'Batch status updated.' : 'Stock adjustment saved.'); close() },
    onError: (error) => toast(error.message, 'error'),
  })
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <Notice>Current unreserved stock: <strong>{batch.stock} packs</strong>.</Notice>
    {!quarantine && <label>Stock change<input required min="-100000" max="100000" step="1" type="number" value={change} onChange={(event) => setChange(event.target.value)} /></label>}
    <label>Reason<textarea required maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{quarantine ? (batch.quarantined ? 'Release batch' : 'Quarantine batch') : 'Save adjustment'}</Button></div>
  </form>
}

function BatchList({ product, open, close }: { product: Product; open: (dialog: Dialog) => void; close: () => void }) {
  return <Modal title="Batches & medicine details" subtitle={product.name} onClose={close} wide>
    <ProductFacts product={product} />
    <Notice>Expired and quarantined packs are excluded from ordering. Stock is reserved by earliest expiry.</Notice>
    <BatchTable batches={product.batches || []} showCost actions={(batch) => <div className="actions"><Button variant="secondary" onClick={() => open({ kind: 'stock', product, batch })}>Adjust</Button><Button variant="ghost" onClick={() => open({ kind: 'quarantine', product, batch })}>{batch.quarantined ? 'Release' : 'Hold'}</Button></div>} />
    <div className="modal-actions"><Button onClick={() => open({ kind: 'receive', product })}><Plus /> Receive batch</Button></div>
  </Modal>
}

export function Inventory() {
  const state = useOutletContext<AppState>()
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
