/* oxlint-disable react/only-export-components */
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { clearApiSession, configureApi } from '../lib/http'
import type { AuthResponse, LicenseStatus, Role, User } from '../types'
import { applyLicenseCachePolicy } from '../lib/license'
import { ToastVisual } from '../components/ui'
import { clearSession, loadLicense, loadMe, setAuth, setLicense as setLicenseAction, signIn, signOut } from '../state/pages/authSlice'
import { refreshPages } from '../state/pages/events'
import { useAppDispatch, useAppSelector } from '../state/store'

interface AuthContextValue {
  user: User | null
  navigationRole: Role | null
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
  const dispatch = useAppDispatch()
  const user = useAppSelector((state) => state.auth.user)
  const navigationRole = useAppSelector((state) => state.auth.navigationRole)
  const license = useAppSelector((state) => state.auth.license)
  const [booting, setBooting] = useState(true)
  const bootstrap = useRef<Promise<void> | null>(null)

  const applyLicense = useCallback((status: LicenseStatus) => {
    dispatch(setLicenseAction(status))
    applyLicenseCachePolicy(queryClient, status)
  }, [dispatch, queryClient])

  const reset = useCallback(() => {
    dispatch(clearSession())
    clearApiSession()
    queryClient.clear()
  }, [dispatch, queryClient])

  const applyAuth = useCallback((response: AuthResponse) => {
    configureApi({ csrf: response.csrf })
    dispatch(setAuth(response))
    applyLicense(response.license)
  }, [applyLicense, dispatch])

  useEffect(() => {
    configureApi({ licenseBlocked: applyLicense, unauthorized: reset })
    bootstrap.current = (async () => {
      try {
        const status = await dispatch(loadLicense()).unwrap()
        applyLicense(status)
        try {
          applyAuth(await dispatch(loadMe()).unwrap())
        } catch {
          reset()
        }
      } catch {
        applyLicense({ usable: false, status: 'unavailable', expires_on: null, expires_at: null })
      } finally {
        setBooting(false)
      }
    })()
  }, [applyAuth, applyLicense, dispatch, reset])

  useEffect(() => {
    const check = async () => {
      try {
        const status = await dispatch(loadLicense()).unwrap()
        applyLicense(status)
        if (status.usable) dispatch(refreshPages())
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
  }, [applyLicense, dispatch])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      navigationRole,
      license,
      booting,
      applyAuth,
      setLicense: applyLicense,
      login: async (email, password) => {
        // Finish restoring the old session before applying a new sign-in.
        await bootstrap.current
        const response = await dispatch(signIn({ email, password })).unwrap()
        applyAuth(response)
        queryClient.clear()
      },
      logout: async () => {
        try {
          await dispatch(signOut()).unwrap()
        } finally {
          reset()
        }
      },
    }),
    [applyAuth, applyLicense, booting, dispatch, license, navigationRole, queryClient, reset, user],
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
