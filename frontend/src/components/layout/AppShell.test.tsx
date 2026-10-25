import { lazy } from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'

const mocks = vi.hoisted(() => ({
  portal: { workspace: null as null | { notifications: [] }, workspaceStatus: 'loading', error: null },
  user: { name: 'Test Admin', role: 'admin', business: 'Test workspace' },
}))
vi.mock('../../providers/AppProviders', () => ({ useAuth: () => ({ user: mocks.user, license: { usable: true }, logout: vi.fn() }) }))
vi.mock('../../state/store', () => ({ useAppSelector: (selector: (state: unknown) => unknown) => selector({ portal: mocks.portal }) }))
vi.mock('../../state/actions', () => ({ api: { state: vi.fn() } }))

beforeEach(() => { mocks.portal.workspace = null; mocks.portal.workspaceStatus = 'loading' })

describe('workspace loading boundaries', () => {
  it('keeps navigation and the route title visible while workspace data is pending', () => {
    render(<MemoryRouter initialEntries={['/inventory']}><AppShell /></MemoryRouter>)
    expect(screen.getByRole('navigation')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Orders' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Medicines & inventory' })).toBeVisible()
    expect(screen.getByLabelText('Loading medicines & inventory')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByRole('main')).toHaveLength(1)
  })

  it('keeps the same navigation mounted while a lazy route resolves', async () => {
    mocks.portal.workspace = { notifications: [] }
    mocks.portal.workspaceStatus = 'ready'
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
