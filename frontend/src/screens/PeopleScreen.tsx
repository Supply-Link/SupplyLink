import { updateUser } from '../state/pages/peopleSlice'
import { useAppDispatch } from '../state/store'
import { useMutation } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import {
  Badge, Button, Card, ConfirmDialog, DataTable, Modal, PageHeader, RoleBadge, SearchInput, Tabs,
  type DataTableColumn,
} from '../components'
import { NewAccount } from '../components/people/NewAccount'
import { ReviewRegistration } from '../components/people/ReviewRegistration'
import { ROLE_NAMES } from '../lib/constants'
import { useAuth, useToast } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'
import type { User } from '../types'

export function People() {
  const dispatch = useAppDispatch()
  const state = usePageData<'people'>()
  const { user } = useAuth()
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
    mutationFn: (person: User) => dispatch(updateUser({ id: person.id, active: !person.active })).unwrap(),
    onSuccess: async () => { setConfirmToggle(null); toast('Account access updated.') },
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
