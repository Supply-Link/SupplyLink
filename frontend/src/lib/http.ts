import type { ApiProblem, LicenseStatus } from '../types'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly license?: LicenseStatus

  constructor(
    message: string,
    status: number,
    code?: string,
    license?: LicenseStatus,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.license = license
  }
}

let csrfToken = ''
let onLicenseBlocked: ((license: LicenseStatus) => void) | undefined
let onUnauthorized: (() => void) | undefined
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
const crossOriginApi = /^https?:\/\//i.test(apiBaseUrl)

function apiUrl(path: string) {
  const endpoint = path.startsWith('/api') ? path.slice(4) : path
  return `${apiBaseUrl}${endpoint}`
}

export function configureApi(options: {
  csrf?: string
  licenseBlocked?: (license: LicenseStatus) => void
  unauthorized?: () => void
}) {
  if (options.csrf !== undefined) csrfToken = options.csrf
  if (options.licenseBlocked) onLicenseBlocked = options.licenseBlocked
  if (options.unauthorized) onUnauthorized = options.unauthorized
}

export function clearApiSession() {
  csrfToken = ''
}

export async function request<T>(
  path: string,
  options: { body?: unknown; idempotencyKey?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  const init: RequestInit = { credentials: crossOriginApi ? 'include' : 'same-origin', headers, signal: options.signal }
  if (options.body !== undefined) {
    init.method = 'POST'
    headers['Content-Type'] = 'application/json'
    headers['X-CSRF-Token'] = csrfToken
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey
    init.body = JSON.stringify(options.body)
  }

  const response = await fetch(apiUrl(path), init)
  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new ApiError('The server returned an unexpected response.', response.status)
  }
  if (!response.ok) {
    const problem = data as ApiProblem
    if (response.status === 423 && problem.code === 'SOFTWARE_LICENSE_BLOCKED' && problem.license) {
      onLicenseBlocked?.(problem.license)
    }
    if (response.status === 401 && path !== '/api/login') onUnauthorized?.()
    throw new ApiError(problem.error || 'Request failed.', response.status, problem.code, problem.license)
  }
  return data as T
}

export const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
