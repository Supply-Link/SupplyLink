import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Box, Check, PackageCheck, ShieldCheck, ShoppingCart, Truck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api } from '../state/actions'
import type { Role } from '../api/types'
import { ROLE_NAMES, STATE_NAMES } from '../lib/constants'
import { useAuth } from '../providers/AppProviders'
import { Button, PageSkeleton } from '../components/ui'

const loginSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(128),
})

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  business: z.string().min(1).max(100),
  email: z.email(),
  password: z.string().min(10).max(128),
  confirm_password: z.string().min(10).max(128),
  role: z.enum(['retailer', 'distributor', 'delivery']),
  address: z.string().min(1).max(500),
  state_code: z.string().length(2),
  gstin: z.string().max(15),
  drug_license: z.string().max(100),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords do not match.',
  path: ['confirm_password'],
})

function AuthStory() {
  return (
    <section className="auth-story">
      <div className="brand"><span><PackageCheck /></span>SupplyLink</div>
      <div className="story-copy">
        <div className="eyebrow">Pharma distribution, connected.</div>
        <h1>Better business.<br /><em>Every step<br />of the way.</em></h1>
        <p>One workspace for your pharmaceutical supply chain. Connect people, products, and deliveries with confidence.</p>
        <div className="flow"><span><Box />Distributors</span><i /><span><ShoppingCart />Retailers</span><i /><span><Truck />Delivery</span></div>
      </div>
      <small>A connected workspace for medicine distribution.</small>
    </section>
  )
}

export function Login() {
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
  const demo = async (role: Role) => {
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
            <button key={role} onClick={() => void demo(role)}>
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

export function Register() {
  const { user, license, booting } = useAuth()
  const navigate = useNavigate()
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'retailer', state_code: '29', gstin: '', drug_license: '' },
  })
  if (booting) return <PageSkeleton />
  if (user) return <Navigate to="/" replace />
  if (license?.usable === false) return <Navigate to="/login" replace />
  const submit = handleSubmit(async (values) => {
    setServerError('')
    try { await api.register(values); setSuccess(true) } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Registration failed.')
    }
  })
  return (
    <main className="auth-layout">
      <AuthStory />
      <section className="auth-form register-form">
        {success ? <>
          <div className="success-icon"><Check /></div><div className="eyebrow">Request received</div>
          <h2>Registration submitted</h2>
          <p>An administrator will review your account and assign access.</p>
          <div className="notice">Your account is pending approval. No portal or LDAP access is enabled yet.</div>
          <Button onClick={() => navigate('/login')}>Return to sign in <ArrowRight /></Button>
        </> : <>
          <div className="eyebrow">Join the connected supply chain</div>
          <h2>Request workspace access</h2>
          <p>Register your business. An administrator will review your requested role.</p>
          <form onSubmit={submit} className="form-grid">
            <label>Full name<input {...register('name')} /></label>
            <label>Business / team name<input {...register('business')} /></label>
            <label>Email address<input type="email" {...register('email')} /></label>
            <label>Password (10+ characters)<input type="password" {...register('password')} /></label>
            <label>Confirm password<input type="password" {...register('confirm_password')} /></label>
            <label>Requested workspace<select {...register('role')}><option value="retailer">Retailer / pharmacy</option><option value="distributor">Distributor / wholesaler</option><option value="delivery">Delivery partner</option></select></label>
            <label className="full">Business / service address<textarea {...register('address')} /></label>
            <label>State / territory<select {...register('state_code')}>{Object.entries(STATE_NAMES).map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}</select></label>
            <label>GSTIN (optional)<input {...register('gstin')} /></label>
            <label>Drug licence (optional)<input {...register('drug_license')} /></label>
            <div className="full notice">Registration does not grant access automatically. Your password works after approval.</div>
            <Button className="full" type="submit" disabled={isSubmitting}>Submit access request <ArrowRight /></Button>
            {(serverError || Object.keys(errors).length > 0) && <p className="full form-error">{serverError || 'Review the highlighted fields.'}</p>}
          </form>
          <p className="register-link">Already registered? <Link to="/login">Return to sign in</Link></p>
        </>}
      </section>
    </main>
  )
}

export function LicenseLock() {
  const { user, license, logout } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return (
    <main className="license-screen">
      <div className="brand"><span><PackageCheck /></span>SupplyLink</div>
      <section className="license-card">
        <div className="license-icon"><ShieldCheck /></div>
        <div className="eyebrow">Software licence</div>
        <h1>{license?.status === 'expired' ? 'Your software licence has expired' : 'Software access is unavailable'}</h1>
        <p>{license?.status === 'expired' ? `The licence expired on ${license.expires_on}.` : 'A valid software licence has not been configured or could not be verified.'}</p>
        <div className="notice">You are signed in as <strong>{user.name}</strong>. Business data and actions are unavailable for every role.</div>
        <p>The portal checks for renewal automatically. Existing business records are retained.</p>
        <Button variant="secondary" onClick={() => void logout()}>Sign out</Button>
      </section>
    </main>
  )
}
