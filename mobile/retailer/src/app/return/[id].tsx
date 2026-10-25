import { useLocalSearchParams, useRouter } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { useState } from 'react';
import { Button, Card, EmptyState, Field, Muted, Screen, Title } from '@/components/ui';
import { dateTime } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function ReturnScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { workspace, request, refresh, keyFor, dropKey, showError, busy } = useSession();
  const order = workspace?.orders.find((entry) => entry.id === id);
  const [reason, setReason] = useState('');
  if (!order) return <Screen title="Return request" onBack={router.back} bottomInset><EmptyState message="This order is unavailable." /></Screen>;

  const submit = async () => {
    if (!reason.trim()) return showError('Describe why you are requesting a return.');
    const scope = `return:${order.id}`;
    const result = await request('POST', '/api/returns', { order_id: order.id, action: 'request', reason: reason.trim() }, { idempotencyKey: keyFor(scope) });
    if (!result) return;
    dropKey(scope);
    await refresh();
  };

  return (
    <Screen title="Return request" subtitle={order.number} onBack={router.back} onRefresh={refresh} bottomInset>
      {order.return_request ? (
        <Card>
          <Title className="text-base">Status: {order.return_request.status}</Title>
          <Muted>Requested {dateTime(order.return_request.requested_at)}</Muted>
          <Muted>Reason: {order.return_request.reason}</Muted>
          {order.return_request.review_note ? <Muted>Review note: {order.return_request.review_note}</Muted> : null}
        </Card>
      ) : order.status === 'delivered' ? (
        <Card>
          <Title className="text-base">Request a return review</Title>
          <Muted>Your distributor will review this request. Submitting does not change stock, issue a refund, or create a credit note.</Muted>
          <Field label="Reason for return" value={reason} onChangeText={setReason} multiline maxLength={500} />
          <Button title="Send return request" icon={RotateCcw} disabled={busy} onPress={submit} />
        </Card>
      ) : <EmptyState message="Return requests are available after delivery." />}
    </Screen>
  );
}
