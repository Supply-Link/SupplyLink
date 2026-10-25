import { savePricing } from '../state/pages/pricingSlice'
import { useAppDispatch } from '../state/store'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Card, FormField, Input, Notice, PageHeader } from '../components'
import { useToast } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'

export function Pricing() {
  const dispatch = useAppDispatch()
  const state = usePageData<'pricing'>()
  const toast = useToast()
  const [minimum, setMinimum] = useState(String(state.pricing.bulk_min))
  const [percent, setPercent] = useState(String(state.pricing.bulk_discount_bps / 100))
  const mutation = useMutation({
    mutationFn: () => dispatch(savePricing({ bulk_min: Number(minimum), bulk_discount_bps: Math.round(Number(percent) * 100) })).unwrap(),
    onSuccess: async () => { toast('Pricing rule saved.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Pricing rules" subtitle="Straightforward bulk savings, calculated consistently on every order." eyebrow={state.user.business} />
    <Card className="narrow-card"><div className="card-head"><div><h2>Volume discount</h2><p>Applies per product, based on ordered quantity.</p></div></div><div className="card-body"><Notice>Changes apply to new orders. Existing orders retain their recorded pricing.</Notice><form className="form-grid" onSubmit={(event) => { event.preventDefault(); mutation.mutate() }}><FormField label="Minimum quantity (packs)"><Input required min="1" max="10000" step="1" type="number" value={minimum} onChange={(event) => setMinimum(event.target.value)} /></FormField><FormField label="Discount (%)"><Input required min="0" max="90" step=".01" type="number" value={percent} onChange={(event) => setPercent(event.target.value)} /></FormField><div className="full modal-actions"><Button type="submit" disabled={mutation.isPending}>Save pricing rule</Button></div></form></div></Card>
  </>
}
