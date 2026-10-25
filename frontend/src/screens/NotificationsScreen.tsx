import { readNotifications } from '../state/pages/notificationsSlice'
import { useAppDispatch } from '../state/store'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { Button, Card, Empty, PageHeader } from '../components'
import { dateTime } from '../lib/helpers'
import { useToast } from '../providers/AppProviders'
import { usePageData } from '../state/pageContext'

export function Notifications() {
  const dispatch = useAppDispatch()
  const state = usePageData<'notifications'>()
  const toast = useToast()
  const mutation = useMutation({
    mutationFn: () => dispatch(readNotifications()).unwrap(),
    onSuccess: async () => { toast('Notifications marked as read.') },
    onError: (error) => toast(error.message, 'error'),
  })
  return <>
    <PageHeader title="Notifications" subtitle="Order milestones and updates, in one place." eyebrow={state.user.business} actions={<Button variant="secondary" onClick={() => mutation.mutate()}><CheckCircle2 /> Mark all as read</Button>} />
    <div className="notifications">{[...state.notifications].reverse().map((notification) => <Card className={`notification ${notification.read ? '' : 'unread'}`} key={notification.id}><strong>{notification.title}</strong><p>{notification.body}</p><time>{dateTime(notification.at)}</time></Card>)}{!state.notifications.length && <Card><Empty title="You’re all caught up">New order and delivery updates will appear here.</Empty></Card>}</div>
  </>
}
