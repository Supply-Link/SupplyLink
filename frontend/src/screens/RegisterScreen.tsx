import { registerAccount } from '../state/pages/authSlice'
import { useAppDispatch } from '../state/store'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Check } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { AuthStory } from '../components/auth/AuthStory'
import { Button } from '../components/ui'
import { STATE_NAMES } from '../lib/constants'
import { useAuth } from '../providers/AppProviders'

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

export function Register() {
  const dispatch = useAppDispatch()
  const { user, license, booting } = useAuth()
  const navigate = useNavigate()
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'retailer', state_code: '29', gstin: '', drug_license: '' },
  })
  if (user) return <Navigate to="/" replace />
  if (license?.usable === false) return <Navigate to="/login" replace />
  const submit = handleSubmit(async (values) => {
    setServerError('')
    try { await dispatch(registerAccount(values)).unwrap(); setSuccess(true) } catch (error) {
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
            <Button className="full" type="submit" disabled={booting || isSubmitting}>Submit access request <ArrowRight /></Button>
            {(serverError || Object.keys(errors).length > 0) && <p className="full form-error">{serverError || 'Review the highlighted fields.'}</p>}
          </form>
          <p className="register-link">Already registered? <Link to="/login">Return to sign in</Link></p>
        </>}
      </section>
    </main>
  )
}
