import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Bell, CheckCircle2, Database, Plus, ShieldCheck, UserCheck, Users as UsersIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { api } from '../api/endpoints'
import type { AppState, Role, User } from '../api/types'
import { ROLE_NAMES } from '../lib/constants'
import { dateTime } from '../lib/helpers'
import { useAuth, useToast } from '../providers/AppProviders'
import {
  Badge, Button, Card, ConfirmDialog, DataTable, DetailPair, Empty, Modal, Notice,
  FormField, Input, PageHeader, RoleBadge, SearchInput, StateSelect, Stat, Tabs,
  type DataTableColumn,
} from '../components'

const useStateData = () => useOutletContext<AppState>()

function NewAccount({ close }: { close: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [values, setValues] = useState({ name: '', business: '', email: '', password: '', role: 'retailer' as Role, credit_limit: '0', address: '' })
  const mutation = useMutation({
    mutationFn: () => api.createUser({
      name: values.name,
      business: values.business,
      email: values.email,
      password: values.password,
      role: values.role,
      ...(values.role === 'retailer' ? { credit_limit: Math.round(Number(values.credit_limit) * 100), address: values.address } : {}),
    }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast('Account created.'); close() },
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

function ReviewRegistration({ person, close }: { person: User; close: () => void }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [role, setRole] = useState<Role>(person.requested_role || person.role)
  const [reason, setReason] = useState('')
  const approve = useMutation({
    mutationFn: () => api.approveRegistration({ user_id: person.id, role }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast('Account approved. Portal and LDAP access enabled.'); close() },
    onError: (error) => toast(error.message, 'error'),
  })
  const reject = useMutation({
    mutationFn: () => api.rejectRegistration({ user_id: person.id, reason }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast('Registration rejected.'); close() },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <div className="facts-grid"><div><small>Applicant</small><strong>{person.name}</strong></div><div><small>Business</small><strong>{person.business}</strong></div><div><small>Address</small><strong>{person.address || 'Not provided'}</strong></div><div><small>Requested role</small><strong>{ROLE_NAMES[person.requested_role || person.role]}</strong></div><div><small>GSTIN</small><strong>{person.gstin || 'Not provided'}</strong></div><div><small>Drug licence</small><strong>{person.drug_license || 'Not provided'}</strong></div></div>
    <label>Grant workspace role<select value={role} onChange={(event) => setRole(event.target.value as Role)}>{Object.entries(ROLE_NAMES).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
    <Notice>Approval grants the selected portal role and LDAP sign-in access.</Notice>
    <div className="modal-actions"><Button onClick={() => approve.mutate()} disabled={approve.isPending}>Approve & grant access</Button></div>
    <hr className="separator" />
    <label>Reason for rejection<textarea maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <div className="modal-actions"><Button variant="danger" disabled={!reason || reject.isPending} onClick={() => reject.mutate()}>Reject request</Button></div>
  </>
}

export function People() {
  const state = useStateData()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [newAccount, setNewAccount] = useState(false)
  const [review, setReview] = useState<User | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<User | null>(null)
  const pending = state.users.filter((person) => person.approval_status === 'pending').length
  const people = state.users.filter((person) => {
    const filterMatch = filter === 'all' || (filter === 'pending' ? person.approval_status === 'pending' : person.role === filter)
    return filterMatch && `${person.name} ${person.email || ''} ${person.business}`.toLowerCase().includes(query.toLowerCase())
  })
  const toggle = useMutation({
    mutationFn: (person: User) => api.updateUser({ id: person.id, active: !person.active }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); setConfirmToggle(null); toast('Account access updated.') },
    onError: (error) => toast(error.message, 'error'),
  })
  const peopleColumns: DataTableColumn<User>[] = [
    { key: 'person', header: 'Person', render: (person) => <><strong>{person.name}</strong><small>{person.email}</small></> },
    { key: 'business', header: 'Business / requested role', render: (person) => <>{person.business}{person.requested_role && <small>Requested: {ROLE_NAMES[person.requested_role]}</small>}</> },
    { key: 'role', header: 'Assigned role', render: (person) => person.approval_status === 'pending' ? <Badge value="Not granted" /> : <RoleBadge role={person.role} /> },
    {
      key: 'access',
      header: 'Access',
      render: (person) => <Badge
        value={person.approval_status === 'pending' ? 'Pending approval' : person.approval_status === 'rejected' ? 'Rejected' : person.active ? 'Active' : 'Inactive'}
        tone={person.approval_status === 'pending' ? 'amber' : person.approval_status === 'rejected' ? 'red' : person.active ? 'green' : 'gray'}
      />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (person) => ['pending', 'rejected'].includes(person.approval_status || '')
        ? <Button variant="secondary" onClick={() => setReview(person)}>Review access</Button>
        : person.id !== user?.id
          ? <Button variant="secondary" onClick={() => setConfirmToggle(person)}>{person.active ? 'Deactivate' : 'Activate'}</Button>
          : <small>Your account</small>,
    },
  ]
  return <>
    <PageHeader title="People, roles & access" subtitle="Approve registrations and control portal and LDAP access." eyebrow={state.user.business} actions={<Button onClick={() => setNewAccount(true)}><Plus /> Add account</Button>} />
    <div className="toolbar"><Tabs value={filter} options={[{ value: 'all', label: 'All accounts' }, { value: 'pending', label: `Pending requests${pending ? ` · ${pending}` : ''}` }, ...Object.entries(ROLE_NAMES).map(([value, name]) => ({ value, label: name }))]} onChange={setFilter} /><SearchInput value={query} onChange={setQuery} placeholder="Search name, business or email" /></div>
    <Card><DataTable rows={people} columns={peopleColumns} rowKey={(person) => person.id} emptyTitle="No matching accounts" emptyMessage="Try another search or view pending requests." /></Card>
    {newAccount && <Modal title="Add an account" subtitle="Create access to the appropriate workspace." onClose={() => setNewAccount(false)}><NewAccount close={() => setNewAccount(false)} /></Modal>}
    {review && <Modal title="Review access request" subtitle={review.email} onClose={() => setReview(null)}><ReviewRegistration person={review} close={() => setReview(null)} /></Modal>}
    <ConfirmDialog open={Boolean(confirmToggle)} title={`${confirmToggle?.active ? 'Deactivate' : 'Activate'} account?`} description={confirmToggle?.active ? 'This account will lose portal access and active sessions will be revoked. Existing records are retained.' : 'This account will regain access to its assigned workspace.'} confirmLabel={confirmToggle?.active ? 'Deactivate account' : 'Activate account'} danger={Boolean(confirmToggle?.active)} pending={toggle.isPending} onClose={() => setConfirmToggle(null)} onConfirm={() => confirmToggle && toggle.mutate(confirmToggle)} />
  </>
}

export function Pricing() {
  const state = useStateData()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [minimum, setMinimum] = useState(String(state.pricing.bulk_min))
  const [percent, setPercent] = useState(String(state.pricing.bulk_discount_bps / 100))
  const mutation = useMutation({
    mutationFn: () => api.savePricing({ bulk_min: Number(minimum), bulk_discount_bps: Math.round(Number(percent) * 100) }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast('Pricing rule saved.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Pricing rules" subtitle="Straightforward bulk savings, calculated consistently on every order." eyebrow={state.user.business} />
    <Card className="narrow-card"><div className="card-head"><div><h2>Volume discount</h2><p>Applies per product, based on ordered quantity.</p></div></div><div className="card-body"><Notice>Changes apply to new orders. Existing orders retain their recorded pricing.</Notice><form className="form-grid" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><FormField label="Minimum quantity (packs)"><Input required min="1" max="10000" step="1" type="number" value={minimum} onChange={(event) => setMinimum(event.target.value)} /></FormField><FormField label="Discount (%)"><Input required min="0" max="90" step=".01" type="number" value={percent} onChange={(event) => setPercent(event.target.value)} /></FormField><div className="full modal-actions"><Button type="submit" disabled={mutation.isPending}>Save pricing rule</Button></div></form></div></Card>
  </>
}

export function Business() {
  const state = useStateData()
  const { user } = useAuth()
  const queryClient = useQueryClient()
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
    mutationFn: () => api.saveBusiness({ user_id: selectedId, ...values }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast('Business profile saved.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Business & GST" subtitle="Maintain business identity, tax registration, and supply-state details." eyebrow={state.user.business} />
    <Card className="narrow-card"><div className="card-head"><h2>Business profile</h2>{user?.role === 'admin' && <select value={selectedId} onChange={(event) => choose(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.business} · {ROLE_NAMES[account.role]}</option>)}</select>}</div><div className="card-body"><Notice>GSTIN and drug-licence identifiers are stored as entered. Registry verification is not connected.</Notice><form onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><div className="form-grid"><label>Legal business name<input required maxLength={150} value={values.legal_name} onChange={(event) => setValues({ ...values, legal_name: event.target.value })} /></label><label>Registered state<StateSelect value={values.state_code} onChange={(state_code) => setValues({ ...values, state_code })} /></label><label className="full">Registered address<textarea required maxLength={500} value={values.address} onChange={(event) => setValues({ ...values, address: event.target.value })} /></label><label>GSTIN (optional)<input maxLength={15} value={values.gstin} onChange={(event) => setValues({ ...values, gstin: event.target.value.toUpperCase() })} /></label><label>Drug licence (optional)<input maxLength={100} value={values.drug_license} onChange={(event) => setValues({ ...values, drug_license: event.target.value })} /></label></div><div className="modal-actions"><Button type="submit" disabled={mutation.isPending}>Save business profile</Button></div></form></div></Card>
  </>
}

export function Activity() {
  const state = useStateData()
  type AuditEvent = AppState['audit'][number]
  const columns: DataTableColumn<AuditEvent>[] = [
    { key: 'action', header: 'Action', render: (event) => <strong>{event.action}</strong> },
    { key: 'detail', header: 'Detail', render: (event) => event.detail },
    { key: 'actor', header: 'Changed by', render: (event) => event.name },
    { key: 'time', header: 'Time', render: (event) => dateTime(event.at) },
  ]
  return <>
    <PageHeader title="Activity log" subtitle="A record of important changes across your workspace." eyebrow={state.user.business} />
    <Card><div className="card-head"><h2>Latest 80 events</h2></div><DataTable rows={state.audit} columns={columns} rowKey={(event) => event.id} emptyTitle="No activity yet" emptyMessage="Changes to orders, products, accounts, and payments appear here." /></Card>
  </>
}

export function Notifications() {
  const state = useStateData()
  const queryClient = useQueryClient()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: api.readNotifications,
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['state'] }); toast('Notifications marked as read.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Notifications" subtitle="Order milestones and updates, in one place." eyebrow={state.user.business} actions={<Button variant="secondary" onClick={() => mutation.mutate()}><CheckCircle2 /> Mark all as read</Button>} />
    <div className="notifications">{[...state.notifications].reverse().map((notification) => <Card className={`notification ${notification.read ? '' : 'unread'}`} key={notification.id}><strong>{notification.title}</strong><p>{notification.body}</p><time>{dateTime(notification.at)}</time></Card>)}{!state.notifications.length && <Card><Empty title="You’re all caught up">New order and delivery updates will appear here.</Empty></Card>}</div>
  </>
}

export function Directory() {
  const state = useStateData()
  const navigate = useNavigate()
  const approved = state.users.filter((person) => person.active && person.approval_status === 'approved').length
  const pending = state.users.filter((person) => person.approval_status === 'pending').length
  return <>
    <PageHeader title="LDAP directory" subtitle="One user directory, shared by portal and LDAP authentication." eyebrow={state.user.business} />
    <div className="stats"><Stat title="Approved accounts" value={approved} note="Portal and LDAP enabled" icon={<UserCheck />} /><Stat title="Pending requests" value={pending} note="Awaiting approval" icon={<UsersIcon />} /><Stat title="Access roles" value={4} note="Four workspace roles" icon={<ShieldCheck />} /><Stat title="Directory storage" value="Local file" note="Shared portal data" icon={<Database />} /></div>
    <div className="grid-two"><Card><div className="card-head"><h2>Connection details</h2><Badge value={state.directory.listener_enabled ? 'Listening' : 'Not running'} tone={state.directory.listener_enabled ? 'green' : 'gray'} /></div><div className="card-body metric-list"><DetailPair label="Directory URL" value={<strong>{state.directory.url || 'ldap://127.0.0.1:1389'}</strong>} /><DetailPair label="Base DN" value={<strong>{state.directory.base_dn}</strong>} /><DetailPair label="Your bind DN" value={<strong>{state.directory.bind_dn}</strong>} /><DetailPair label="Authentication" value={<strong>LDAPv3 simple bind</strong>} /><Notice>The local service supports bind, scoped searches, groups, and Who Am I. LDAP writes, SASL, paging, and StartTLS are not implemented.</Notice></div></Card><Card><div className="card-head"><h2>Access management</h2></div><div className="card-body"><div className="activity"><UsersIcon /><div><b>Registration requests</b><small>Review the requested role before granting access.</small></div></div><div className="activity"><ShieldCheck /><div><b>One approval model</b><small>Approval controls both portal and LDAP sign-in.</small></div></div><div className="activity"><Bell /><div><b>Role-limited visibility</b><small>Non-admin users only see their account and membership.</small></div></div><div className="modal-actions"><Button onClick={() => navigate('/people')}>Review people & access</Button></div></div></Card></div>
  </>
}
