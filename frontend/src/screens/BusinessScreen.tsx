import { saveBusiness } from '../state/pages/businessSlice'
import { useAppDispatch } from '../state/store'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button, Card, Notice, PageHeader, StateSelect } from '../components'
import { ROLE_NAMES } from '../lib/constants'
import { useAuth, useToast } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'

export function Business() {
  const dispatch = useAppDispatch()
  const state = usePageData<'business'>()
  const { user } = useAuth()
  const toast = useToast()
  const accounts = useMemo(() => user?.role === 'admin' ? state.users.filter((person) => person.role !== 'delivery') : [state.user], [state, user])
  const [selectedId, setSelectedId] = useState(state.user.id)
  const selected = accounts.find((person) => person.id === selectedId) || state.user
  const [values, setValues] = useState({ legal_name: selected.legal_name || selected.business, address: selected.address || '', state_code: selected.state_code || '29', gstin: selected.gstin || '', drug_license: selected.drug_license || '' })
  const choose = (id: string) => {
    const account = accounts.find((person) => person.id === id)!
    setSelectedId(id)
    setValues({ legal_name: account.legal_name || account.business, address: account.address || '', state_code: account.state_code || '29', gstin: account.gstin || '', drug_license: account.drug_license || '' })
  }
  const mutation = useMutation({
    mutationFn: () => dispatch(saveBusiness({ user_id: selectedId, ...values })).unwrap(),
    onSuccess: async () => { toast('Business profile saved.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Business & GST" subtitle="Maintain business identity, tax registration, and supply-state details." eyebrow={state.user.business} />
    <Card className="narrow-card"><div className="card-head"><h2>Business profile</h2>{user?.role === 'admin' && <select value={selectedId} onChange={(event) => choose(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.business} · {ROLE_NAMES[account.role]}</option>)}</select>}</div><div className="card-body"><Notice>GSTIN and drug-licence identifiers are stored as entered. Registry verification is not connected.</Notice><form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><div className="form-grid"><label>Legal business name<input required maxLength={150} value={values.legal_name} onChange={(event) => setValues({ ...values, legal_name: event.target.value })} /></label><label>Registered state<StateSelect value={values.state_code} onChange={(state_code) => setValues({ ...values, state_code })} /></label><label className="full">Registered address<textarea required maxLength={500} value={values.address} onChange={(event) => setValues({ ...values, address: event.target.value })} /></label><label>GSTIN (optional)<input maxLength={15} value={values.gstin} onChange={(event) => setValues({ ...values, gstin: event.target.value.toUpperCase() })} /></label><label>Drug licence (optional)<input maxLength={100} value={values.drug_license} onChange={(event) => setValues({ ...values, drug_license: event.target.value })} /></label></div><div className="modal-actions"><Button type="submit" disabled={mutation.isPending}>Save business profile</Button></div></form></div></Card>
  </>
}
