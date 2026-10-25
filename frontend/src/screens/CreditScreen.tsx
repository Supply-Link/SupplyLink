import { updateUser } from '../state/pages/peopleSlice'
import { useAppDispatch } from '../state/store'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Button, Card, CreditMeter, DetailPair, Modal, Notice, PageHeader } from '../components'
import { money } from '../lib/helpers'
import { useAuth, useToast } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'

export function Credit() {
  const dispatch = useAppDispatch()
  const state = usePageData<'credit'>()
  const { user } = useAuth()
  const toast = useToast()
  const [editing, setEditing] = useState<string | null>(null)
  const [limit, setLimit] = useState('')
  const retailers = useMemo(() => user?.role === 'retailer' ? [state.user] : state.users.filter((person) => person.role === 'retailer'), [state, user])
  const save = useMutation({
    mutationFn: ({ id, credit_limit }: { id: string; credit_limit: number }) =>
      dispatch(updateUser({ id, credit_limit })).unwrap(),
    onSuccess: async () => { setEditing(null); toast('Credit limit updated.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Trade credit" subtitle="Manage purchasing capacity and outstanding balances." eyebrow={state.user.business} />
    <Notice>Trade credit is reserved when an order is placed and released after payment or cancellation.</Notice>
    <div className="credit-grid">{retailers.map((retailer) => {
      const creditLimit = retailer.credit_limit || 0
      const creditUsed = retailer.credit_used || 0
      const available = creditLimit - creditUsed
      return <Card key={retailer.id}><div className="card-head"><div><h2>{retailer.business}</h2><p>{retailer.name}</p></div>{user?.role === 'admin' && <Button variant="secondary" onClick={() => { setEditing(retailer.id); setLimit(String(creditLimit / 100)) }}>Edit limit</Button>}</div><div className="card-body"><small>AVAILABLE PURCHASING CREDIT</small><div className="credit-amount">{money(available)}</div><CreditMeter used={creditUsed} limit={creditLimit} /><DetailPair label="Approved limit" value={<strong>{money(creditLimit)}</strong>} /><DetailPair label="Outstanding" value={<strong>{money(creditUsed)}</strong>} /></div></Card>
    })}</div>
    {editing && <Modal title="Update trade credit limit" onClose={() => setEditing(null)}><label>Approved limit (₹)<input type="number" min={(retailers.find((person) => person.id === editing)?.credit_used || 0) / 100} step="0.01" value={limit} onChange={(event) => setLimit(event.target.value)} /></label><div className="modal-actions"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => save.mutate({ id: editing, credit_limit: Math.round(Number(limit) * 100) })}>Save credit limit</Button></div></Modal>}
  </>
}
