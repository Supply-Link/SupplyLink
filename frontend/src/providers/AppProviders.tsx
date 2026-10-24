/* oxlint-disable react/only-export-components */
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api/endpoints'
import { clearApiSession, configureApi } from '../api/client'
import type { AuthResponse, LicenseStatus, User } from '../api/types'
import { applyLicenseCachePolicy } from '../lib/license'
import { ToastVisual } from '../components/ui'

interface AuthContextValue {
  user: User | null
  license: LicenseStatus | null
  booting: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  applyAuth: (response: AuthResponse) => void
  setLicense: (license: LicenseStatus) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)
const ToastContext = createContext<(message: string, tone?: 'success' | 'error') => void>(() => undefined)

function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [booting, setBooting] = useState(true)

  const applyLicense = useCallback((status: LicenseStatus) => {
    setLicense(status)
    applyLicenseCachePolicy(queryClient, status)
  }, [queryClient])

  const reset = useCallback(() => {
    setUser(null)
    clearApiSession()
    queryClient.clear()
  }, [queryClient])

  const applyAuth = useCallback((response: AuthResponse) => {
    configureApi({ csrf: response.csrf })
    setUser(response.user)
    applyLicense(response.license)
  }, [applyLicense])

  useEffect(() => {
    configureApi({ licenseBlocked: applyLicense, unauthorized: reset })
    void (async () => {
      try {
        const status = await api.license()
        applyLicense(status)
        try {
          applyAuth(await api.me())
        } catch {
          reset()
        }
      } finally {
        setBooting(false)
      }
    })()
  }, [applyAuth, applyLicense, reset])

  useEffect(() => {
    const check = async () => {
      try {
        const status = await api.license()
        applyLicense(status)
        if (status.usable) void queryClient.invalidateQueries({ queryKey: ['state'] })
      } catch {
        applyLicense({ usable: false, status: 'unavailable', expires_on: null, expires_at: null })
      }
    }
    const interval = window.setInterval(() => void check(), 15_000)
    const onFocus = () => void check()
    const onVisibility = () => {
      if (!document.hidden) void check()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [applyLicense, queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      license,
      booting,
      applyAuth,
      setLicense: applyLicense,
      login: async (email, password) => {
        const response = await api.login({ email, password })
        applyAuth(response)
        queryClient.clear()
      },
      logout: async () => {
        try {
          await api.logout()
        } finally {
          reset()
        }
      },
    }),
    [applyAuth, applyLicense, booting, license, queryClient, reset, user],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const show = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone })
    window.setTimeout(() => setToast(null), 4200)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && <ToastVisual message={toast.message} tone={toast.tone} />}
    </ToastContext.Provider>
  )
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: false }, mutations: { retry: false } },
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AppProviders')
  return value
}

export const useToast = () => useContext(ToastContext)
