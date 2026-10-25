import { createUser } from '../../state/pages/peopleSlice'
import { useAppDispatch } from '../../state/store'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button } from '..'
import { ROLE_NAMES } from '../../lib/constants'
import { useToast } from '../../providers/AppProviders'
import type { Role } from '../../types'

export function NewAccount({ close }: { close: () => void }) {
  const dispatch = useAppDispatch()
  const toast = useToast()
  const [values, setValues] = useState({ name: '', business: '', email: '', password: '', role: 'retailer' as Role, credit_limit: '0', address: '' })
  const mutation = useMutation({
    mutationFn: () => dispatch(createUser({
      name: values.name,
      business: values.business,
      email: values.email,
      password: values.password,
      role: values.role,
      ...(values.role === 'retailer' ? { credit_limit: Math.round(Number(values.credit_limit) * 100), address: values.address } : {}),
    })).unwrap(),
    onSuccess: async () => { toast('Account created.'); close() },
    onError: (error) => toast(error.message, 'error'),
  })
  return <form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}>
    <div className="form-grid">
      <label>Full name<input required maxLength={100} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} /></label>
      <label>Business / team<input required maxLength={100} value={values.business} onChange={(event) => setValues({ ...values, business: event.target.value })} /></label>
      <label>Email address<input required type="email" maxLength={150} value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} /></label>
      <label>Temporary password<input required type="password" minLength={10} maxLength={128} value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} /></label>
      <label>Workspace role<select value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value as Role })}>{Object.entries(ROLE_NAMES).map(([role, name]) => <option key={role} value={role}>{name}</option>)}</select></label>
      {values.role === 'retailer' && <><label>Trade credit limit (₹)<input required min="0" step=".01" type="number" value={values.credit_limit} onChange={(event) => setValues({ ...values, credit_limit: event.target.value })} /></label><label className="full">Delivery address<textarea required maxLength={500} value={values.address} onChange={(event) => setValues({ ...values, address: event.target.value })} /></label></>}
    </div>
    <div className="modal-actions"><Button type="button" variant="secondary" onClick={close}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>Create account</Button></div>
  </form>
}
