import type { Order, Quote, Role } from '../../api/types'
import { date, money } from '../../lib/helpers'
import { Button, DataTable, DetailPair, StatusBadge, type DataTableColumn } from '../ui'

export function OrderTable({
  orders,
  role,
  onView,
}: {
  orders: readonly Order[]
  role?: Role
  onView: (order: Order) => void
}) {
  const columns: DataTableColumn<Order>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (order) => <><strong>{order.number}</strong><small>{date(order.created_at)}</small></>,
    },
    {
      key: 'party',
      header: role === 'retailer' ? 'Items' : 'Retailer',
      render: (order) => <>{role === 'retailer' ? `${order.lines.reduce((sum, line) => sum + line.quantity, 0)} packs` : order.retailer_name}<small>{order.lines.length} products</small></>,
    },
    { key: 'amount', header: 'Amount', render: (order) => <strong>{money(order.total)}</strong> },
    { key: 'status', header: 'Status', render: (order) => <StatusBadge value={order.status} /> },
    { key: 'payment', header: 'Payment', render: (order) => <StatusBadge value={order.payment_status} /> },
    { key: 'action', header: null, render: (order) => <Button variant="ghost" onClick={() => onView(order)}>View</Button> },
  ]
  return <DataTable rows={orders} columns={columns} rowKey={(order) => order.id} emptyTitle="No orders to show" emptyMessage="Orders will appear here when they are placed." />
}

type TaxValue = Pick<
  Order,
  'subtotal' | 'discount' | 'taxable' | 'cgst' | 'sgst' | 'utgst' | 'igst' | 'total' | 'tax_type'
> | Quote

export function TaxBreakdown({ value }: { value: TaxValue }) {
  if (value.taxable === undefined) return <DetailPair label="Total" value={<strong>{money(value.total)}</strong>} total />
  return <div className="tax-summary">
    <DetailPair label="Subtotal (excl. GST)" value={<span>{money(value.subtotal)}</span>} />
    <DetailPair label="Bulk savings" value={<span>−{money(value.discount)}</span>} />
    <DetailPair label="Taxable value" value={<span>{money(value.taxable)}</span>} />
    {value.tax_type === 'IGST'
      ? <DetailPair label="IGST" value={<span>{money(value.igst)}</span>} />
      : <>
        <DetailPair label="CGST" value={<span>{money(value.cgst)}</span>} />
        <DetailPair label={value.tax_type === 'CGST + UTGST' ? 'UTGST' : 'SGST'} value={<span>{money(value.tax_type === 'CGST + UTGST' ? value.utgst : value.sgst)}</span>} />
      </>}
    <DetailPair label="Order total (incl. GST)" value={<strong>{money(value.total)}</strong>} total />
  </div>
}

export const TaxSummary = TaxBreakdown
