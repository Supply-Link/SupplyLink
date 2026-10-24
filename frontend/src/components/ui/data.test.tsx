import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataTable, type DataTableColumn } from './data'

interface MedicineRow {
  id: string
  name: string
  stock: number
}

const columns: DataTableColumn<MedicineRow>[] = [
  { key: 'name', header: 'Medicine', render: (row) => <strong>{row.name}</strong> },
  { key: 'stock', header: 'Stock', render: (row) => `${row.stock} packs` },
]

describe('DataTable', () => {
  it('renders generic column headers and row values', () => {
    render(<DataTable
      rows={[{ id: '1', name: 'Paracetamol', stock: 18 }]}
      columns={columns}
      rowKey={(row) => row.id}
    />)

    const table = screen.getByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Medicine' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Paracetamol' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: '18 packs' })).toBeInTheDocument()
  })

  it('shows the caller-provided empty state instead of a table', () => {
    render(<DataTable
      rows={[]}
      columns={columns}
      rowKey={(row) => row.id}
      emptyTitle="No medicines"
      emptyMessage="Receive stock to begin."
    />)

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('No medicines')).toBeInTheDocument()
    expect(screen.getByText('Receive stock to begin.')).toBeInTheDocument()
  })
})
