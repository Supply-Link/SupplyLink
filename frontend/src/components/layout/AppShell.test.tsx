import { lazy } from 'react'
import type { Role } from '../../types'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'
import { PageDataBoundary } from './PageDataBoundary'

const mocks = vi.hoisted(() => ({
  pages: { shell: { data: null, status: 'loading', error: null }, inventory: { data: null, status: 'loading', error: null } },
  user: { name: 'Test Admin', role: 'admin', business: 'Test workspace' } as { name: string; role: Role; business: string } | null,
  navigationRole: 'admin' as Role,
}))
vi.mock('../../providers/AppProviders', () => ({ useAuth: () => ({ user: mocks.user, navigationRole: mocks.navigationRole, license: { usable: true }, logout: vi.fn() }) }))
vi.mock('../../state/store', () => ({ useAppDispatch: () => vi.fn(), useAppSelector: (selector: (state: unknown) => unknown) => selector({ pages: mocks.pages }) }))

beforeEach(() => { mocks.pages.inventory.status = 'loading'; mocks.user = { name: 'Test Admin', role: 'admin', business: 'Test workspace' } })

describe('workspace loading boundaries', () => {
  it('shows cached navigation while session verification is pending and adopts the verified role', () => {
    mocks.user = null
    const { rerender } = render(<MemoryRouter><AppShell pending /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'People & roles' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Orders' })).toBeVisible()
    expect(screen.getByLabelText('Loading overview')).toBeVisible()
    mocks.user = { name: 'Retailer', role: 'retailer', business: 'Pharmacy' }
    rerender(<MemoryRouter><AppShell pending /></MemoryRouter>)
    expect(screen.queryByRole('link', { name: 'People & roles' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Medicine catalog' })).toBeVisible()
  })

  it('keeps navigation and the route title visible while workspace data is pending', () => {
    render(<MemoryRouter initialEntries={['/inventory']}><Routes><Route element={<AppShell />}><Route path="inventory" element={<PageDataBoundary page="inventory"><h1>Inventory ready</h1></PageDataBoundary>} /></Route></Routes></MemoryRouter>)
    expect(screen.getByRole('navigation')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Orders' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Medicines & inventory' })).toBeVisible()
    expect(screen.getByLabelText('Loading medicines & inventory')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('keeps the same navigation mounted while a lazy route resolves', async () => {
    let resolve!: (value: { default: () => React.ReactNode }) => void
    const Delayed = lazy(() => new Promise<{ default: () => React.ReactNode }>((done) => { resolve = done }))
    render(<MemoryRouter initialEntries={['/orders']}><Routes><Route element={<AppShell />}><Route path="orders" element={<Delayed />} /></Route></Routes></MemoryRouter>)
    const navigation = screen.getByRole('navigation')
    expect(screen.getByLabelText('Loading orders')).toBeVisible()
    await act(async () => { resolve({ default: () => <h1>Orders ready</h1> }) })
    expect(screen.getByRole('heading', { name: 'Orders ready' })).toBeVisible()
    expect(screen.getByRole('navigation')).toBe(navigation)
    expect(screen.queryByLabelText('Loading orders')).not.toBeInTheDocument()
  })
})
