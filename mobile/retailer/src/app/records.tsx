import { useRouter } from 'expo-router';
import { FileText, PackageSearch, RotateCcw } from 'lucide-react-native';
import { Text } from 'react-native';
import { Button, Card, EmptyState, Muted, Screen, SectionLabel, Title } from '@/components/ui';
import { dateTime, money, stageLabel } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function RecordsScreen() {
  const router = useRouter();
  const { workspace, refresh } = useSession();
  const orders = [...(workspace?.orders ?? [])].reverse();
  return (
    <Screen title="Order records & returns" subtitle="Saved order facts and return requests" onBack={router.back} onRefresh={refresh} bottomInset>
      <Card>
        <Title className="text-base">Transaction records</Title>
        <Muted>Each order keeps the supplier, buyer, batch and GST values captured when it was placed. These records are not statutory tax invoices or credit notes.</Muted>
      </Card>
      <SectionLabel>Your orders</SectionLabel>
      {orders.length === 0 ? <EmptyState message="No order records yet." icon={PackageSearch} /> : null}
      {orders.map((order) => (
        <Card key={order.id}>
          <Title className="text-base">{order.number} · {money(order.total)}</Title>
          <Muted>{stageLabel(order.status)} · {dateTime(order.created_at)}</Muted>
          {order.return_request ? <Text className="mt-2 text-sm font-semibold text-brand">Return {order.return_request.status}</Text> : null}
          <Button title="View transaction record" icon={FileText} variant="secondary" onPress={() => router.push({ pathname: '/statement/[id]', params: { id: order.id } })} />
          {order.status === 'delivered' ? (
            <Button title={order.return_request ? 'View return request' : 'Request a return'} icon={RotateCcw} variant="secondary" onPress={() => router.push({ pathname: '/return/[id]', params: { id: order.id } })} />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
