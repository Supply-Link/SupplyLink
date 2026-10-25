import { Bell, Database, ShieldCheck, UserCheck, Users as UsersIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, DetailPair, Notice, PageHeader, Stat } from '../components'
import { usePageData } from '../state/pageContext'

export function Directory() {
  const state = usePageData<'directory'>()
  const navigate = useNavigate()
  const approved = state.users.filter((person) => person.active && person.approval_status === 'approved').length
  const pending = state.users.filter((person) => person.approval_status === 'pending').length
  return <>
    <PageHeader title="LDAP directory" subtitle="One user directory, shared by portal and LDAP authentication." eyebrow={state.user.business} />
    <div className="stats"><Stat title="Approved accounts" value={approved} note="Portal and LDAP enabled" icon={<UserCheck />} /><Stat title="Pending requests" value={pending} note="Awaiting approval" icon={<UsersIcon />} /><Stat title="Access roles" value={4} note="Four workspace roles" icon={<ShieldCheck />} /><Stat title="Directory storage" value="Local file" note="Shared portal data" icon={<Database />} /></div>
    <div className="grid-two"><Card><div className="card-head"><h2>Connection details</h2><Badge value={state.directory.listener_enabled ? 'Listening' : 'Not running'} tone={state.directory.listener_enabled ? 'green' : 'gray'} /></div><div className="card-body metric-list"><DetailPair label="Directory URL" value={<strong>{state.directory.url || 'ldap://127.0.0.1:1389'}</strong>} /><DetailPair label="Base DN" value={<strong>{state.directory.base_dn}</strong>} /><DetailPair label="Your bind DN" value={<strong>{state.directory.bind_dn}</strong>} /><DetailPair label="Authentication" value={<strong>LDAPv3 simple bind</strong>} /><Notice>The local service supports bind, scoped searches, groups, and Who Am I. LDAP writes, SASL, paging, and StartTLS are not implemented.</Notice></div></Card><Card><div className="card-head"><h2>Access management</h2></div><div className="card-body"><div className="activity"><UsersIcon /><div><b>Registration requests</b><small>Review the requested role before granting access.</small></div></div><div className="activity"><ShieldCheck /><div><b>One approval model</b><small>Approval controls both portal and LDAP sign-in.</small></div></div><div className="activity"><Bell /><div><b>Role-limited visibility</b><small>Non-admin users only see their account and membership.</small></div></div><div className="modal-actions"><Button onClick={() => navigate('/people')}>Review people & access</Button></div></div></Card></div>
  </>
}
