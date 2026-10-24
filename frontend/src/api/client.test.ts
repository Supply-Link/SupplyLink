import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, clearApiSession, configureApi, request } from './client'

const jsonResponse = (data: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(data),
})

afterEach(() => {
  clearApiSession()
  vi.unstubAllGlobals()
})

describe('API client', () => {
  it('sends authenticated mutation safeguards without reaching the network', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    configureApi({ csrf: 'csrf-token' })

    await request('/api/orders', {
      body: { product_id: 'medicine-1', quantity: 2 },
      idempotencyKey: 'order-key',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'csrf-token',
        'Idempotency-Key': 'order-key',
      },
      body: JSON.stringify({ product_id: 'medicine-1', quantity: 2 }),
    }))
  })

  it('notifies the application when a session is unauthorized', async () => {
    const unauthorized = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Sign in again.' }, 401)))
    configureApi({ unauthorized })

    await expect(request('/api/state')).rejects.toMatchObject({
      status: 401,
      message: 'Sign in again.',
    } satisfies Partial<ApiError>)
    expect(unauthorized).toHaveBeenCalledOnce()
  })

  it('passes licence details to the lock callback', async () => {
    const license = {
      usable: false,
      status: 'expired',
      expires_on: '2026-10-23',
      expires_at: '2026-10-23T23:59:59Z',
    }
    const licenseBlocked = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: 'Licence expired.',
      code: 'SOFTWARE_LICENSE_BLOCKED',
      license,
    }, 423)))
    configureApi({ licenseBlocked })

    await expect(request('/api/state')).rejects.toMatchObject({
      status: 423,
      code: 'SOFTWARE_LICENSE_BLOCKED',
    } satisfies Partial<ApiError>)
    expect(licenseBlocked).toHaveBeenCalledWith(license)
  })
})
