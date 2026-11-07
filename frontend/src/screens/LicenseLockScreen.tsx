import { PackageCheck, ShieldCheck } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { Button } from '../components/ui'
import { useAuth } from '../providers/AppProviders'

export function LicenseLockScreen() {
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
