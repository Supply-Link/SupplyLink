import { Card, DataTable, PageHeader, type DataTableColumn } from '../components'
import { dateTime } from '../lib/helpers'
import { usePageData } from '../state/pageContext'
import type { AppState } from '../types'

export function ActivityScreen() {
  const state = usePageData<'activity'>()
  type AuditEvent = AppState['audit'][number]
  const columns: DataTableColumn<AuditEvent>[] = [
    { key: 'action', header: 'Action', render: (event) => <strong>{event.action}</strong> },
    { key: 'detail', header: 'Detail', render: (event) => event.detail },
    { key: 'actor', header: 'Changed by', render: (event) => event.name },
    { key: 'time', header: 'Time', render: (event) => dateTime(event.at) },
  ]
  return <>
    <PageHeader title="Activity log" subtitle="A record of important changes across your workspace." eyebrow={state?.user?.business} />
    <Card><div className="card-head"><h2>Latest 80 events</h2></div><DataTable rows={state?.audit ?? []} columns={columns} rowKey={(event) => event.id} emptyTitle="No activity yet" emptyMessage="Changes to orders, products, accounts, and payments appear here." /></Card>
  </>
}
