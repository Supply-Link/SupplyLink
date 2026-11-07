import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Box, ShieldCheck, ShoppingCart, Truck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthStory } from '../components/auth/AuthStory'
import { Button } from '../components/ui'
import { ROLE_NAMES } from '../lib/constants'
import { useAuth } from '../providers/AppProviders'
import type { Role } from '../types'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(128),
})

export function LoginScreen() {
  const { user, license, login } = useAuth()
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  })
  if (user) return <Navigate to="/" replace />
  const submit = handleSubmit(async (values) => {
    setServerError('')
    try { await login(values.email, values.password) } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Sign in failed.')
    }
  })
  const handleDemoSignIn = async (role: Role) => {
    setServerError('')
    try { await login(`${role}@supplylink.local`, 'Demo@123') } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Sign in failed.')
    }
  }
  return (
    <main className="auth-layout">
      <AuthStory />
      <section className="auth-form">
        <div className="eyebrow">Your business, in sync</div>
        <h2>Welcome to SupplyLink</h2>
        <p>Sign in to your distribution workspace.</p>
        {license && !license.usable && <div className="notice amber">The software licence is unavailable. You can sign in, but business actions remain locked.</div>}
        <form onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="username" {...register('email')} /></label>
          <small className="field-error">{errors.email?.message}</small>
          <label>Password<input type="password" autoComplete="current-password" {...register('password')} /></label>
          <small className="field-error">{errors.password?.message}</small>
          <Button type="submit" disabled={isSubmitting}>Sign in to workspace <ArrowRight /></Button>
          {serverError && <p className="form-error" role="alert">{serverError}</p>}
        </form>
        <div className="divider">Explore a demo workspace</div>
        <div className="role-grid">
          {(['admin', 'distributor', 'retailer', 'delivery'] as Role[]).map((role) => (
            <button key={role} onClick={() => void handleDemoSignIn(role)}>
              {{ admin: <ShieldCheck />, distributor: <Box />, retailer: <ShoppingCart />, delivery: <Truck /> }[role]}
              <span><strong>{ROLE_NAMES[role]}</strong><small>Explore this workspace</small></span>
            </button>
          ))}
        </div>
        {license?.usable !== false && <p className="register-link">New to SupplyLink? <Link to="/register">Request workspace access</Link></p>}
      </section>
    </main>
  )
}
