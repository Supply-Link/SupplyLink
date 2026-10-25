import { saveProduct } from '../../state/pages/inventorySlice'
import { useAppDispatch } from '../../state/store'
import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useRef, useState } from 'react'
import { Button } from '..'
import { useAuth, useToast } from '../../providers/AppProviders'
import type { PagePayloads } from '../../state/pages/types'
import type { Product, ProductInput } from '../../types'

export function ProductForm({
  product,
  state,
  close,
  onCreated,
}: {
  product?: Product
  state: PagePayloads['inventory']
  close: () => void
  onCreated: (product: Product) => void
}) {
  const dispatch = useAppDispatch()
  const { user } = useAuth()
  const toast = useToast()
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
      const XLSX = await import('xlsx')
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

          await dispatch(saveProduct({
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
          })).unwrap()

          created++
        } catch (error) {
          errors.push(
            `Row ${rowNumber}: ${error instanceof Error ? error.message : 'Import failed'
            }`,
          )
        }
      }

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
    mutationFn: (body: ProductInput) => dispatch(saveProduct(body)).unwrap(),
    onSuccess: async (savedProduct) => {
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
