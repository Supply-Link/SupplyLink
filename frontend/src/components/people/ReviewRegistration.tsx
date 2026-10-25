import { approveRegistration, rejectRegistration } from '../../state/pages/peopleSlice'
import { useAppDispatch } from '../../state/store'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Notice } from '..'
import { ROLE_NAMES } from '../../lib/constants'
import { useToast } from '../../providers/AppProviders'
import type { Role, User } from '../../types'

export function ReviewRegistration({ person, close }: { person: User; close: () => void }) {
  const dispatch = useAppDispatch()
  const toast = useToast()
  const [role, setRole] = useState<Role>(person.requested_role || person.role)
  const [reason, setReason] = useState('')
  const approve = useMutation({
    mutationFn: () => dispatch(approveRegistration({ user_id: person.id, role })).unwrap(),
    onSuccess: async () => { toast('Account approved. Portal and LDAP access enabled.'); close() },
    onError: (error) => toast(error.message, 'error'),
  })
  const reject = useMutation({
    mutationFn: () => dispatch(rejectRegistration({ user_id: person.id, reason })).unwrap(),
    onSuccess: async () => { toast('Registration rejected.'); close() },
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
