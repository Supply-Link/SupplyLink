import type { ReactNode } from 'react'
import { dateTime, label } from '../../lib/helpers'
import { Card, EmptyState } from './primitives'

export interface DataTableColumn<T> {
  key: string
  header: ReactNode
  render: (row: T) => ReactNode
  className?: string
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  emptyTitle = 'No records',
  emptyMessage = 'Records will appear here.',
}: {
  rows: readonly T[]
  columns: readonly DataTableColumn<T>[]
  rowKey: (row: T) => string
  emptyTitle?: string
  emptyMessage?: ReactNode
}) {
  if (!rows.length) return <EmptyState title={emptyTitle}>{emptyMessage}</EmptyState>
  return <div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column.key} className={column.className}>{column.header}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={rowKey(row)}>{columns.map((column) => <td key={column.key} className={column.className}>{column.render(row)}</td>)}</tr>)}</tbody></table></div>
}

export function StatCard({
  title,
  value,
  note,
  icon,
}: {
  title: string
  value: ReactNode
  note: string
  icon: ReactNode
}) {
  return <Card className="stat"><div className="stat-title">{title}<span>{icon}</span></div><strong>{value}</strong><small>{note}</small></Card>
}

export const Stat = StatCard

export function DetailPair({
  label: title,
  value,
  total = false,
}: {
  label: ReactNode
  value: ReactNode
  total?: boolean
}) {
  return <div className={`detail-row ${total ? 'total' : ''}`}><span>{title}</span>{value}</div>
}

export interface TimelineEntry {
  status: string
  at: string
  by: string
}

export function Timeline({ entries }: { entries: readonly TimelineEntry[] }) {
  return <ol className="timeline">{entries.map((entry, index) => <li key={`${entry.at}-${index}`}><b>{label(entry.status)}</b><small>{dateTime(entry.at)} · {entry.by}</small></li>)}</ol>
}

export interface BarChartDatum {
  label: string
  value: number
  formattedValue?: string
}

export function BarChart({ data, ariaLabel = 'Bar chart' }: { data: readonly BarChartDatum[]; ariaLabel?: string }) {
  const max = Math.max(1, ...data.map((datum) => datum.value))
  return <div className="chart" role="img" aria-label={ariaLabel}>{data.map((datum) => <div className="chart-col" key={datum.label} title={`${datum.label}: ${datum.formattedValue ?? datum.value}`}><div className="chart-bar" style={{ height: `${datum.value ? Math.max(4, datum.value / max * 115) : 3}px` }} /><span>{datum.label}</span></div>)}</div>
}
