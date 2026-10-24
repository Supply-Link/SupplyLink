import type { Order, Payment, Role } from '../api/types'

export const money = (paise = 0) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(paise / 100)

export const date = (value: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))

export const dateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export const label = (value: string) =>
  value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase())

const routeRoles: Record<string, Role[]> = {
  dashboard: ['admin', 'distributor', 'retailer', 'delivery'],
  catalog: ['retailer'],
  orders: ['admin', 'distributor', 'retailer'],
  deliveries: ['admin', 'distributor', 'delivery'],
  payments: ['admin', 'distributor', 'retailer', 'delivery'],
  credit: ['admin', 'retailer'],
  inventory: ['admin', 'distributor'],
  people: ['admin'],
  pricing: ['admin'],
  activity: ['admin'],
  business: ['admin', 'distributor', 'retailer'],
  directory: ['admin'],
  notifications: ['admin', 'distributor', 'retailer', 'delivery'],
}

export const canAccess = (role: Role, route: string) => routeRoles[route]?.includes(role) ?? false

function csvCell(value: unknown) {
  let result = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(result)) result = `'${result}`
  return `"${result.replaceAll('"', '""')}"`
}

export function downloadCsv(kind: 'orders' | 'payments', records: Order[] | Payment[]) {
  const rows =
    kind === 'orders'
      ? [
          ['Order', 'Retailer', 'Created', 'Amount INR', 'Status', 'Payment'],
          ...(records as Order[]).map((order) => [
            order.number, order.retailer_name, order.created_at, (order.total / 100).toFixed(2),
            order.status, order.payment_status,
          ]),
        ]
      : [
          ['Receipt', 'Order', 'Amount INR', 'Reference', 'Recorded'],
          ...(records as Payment[]).map((payment) => [
            payment.id, payment.order_number, (payment.amount / 100).toFixed(2),
            payment.reference, payment.at,
          ]),
        ]
  const blob = new Blob([`\ufeff${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], {
    type: 'text/csv;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `supplylink-${kind}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
