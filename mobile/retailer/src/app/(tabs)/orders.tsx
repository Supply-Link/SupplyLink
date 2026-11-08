// Orders tab — chronological list of all orders with live status badges.

import { ReceiptText, RefreshCw } from 'lucide-react-native';
import { OrderCard } from '@/components/orders';
import { Button, EmptyState, Screen } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

export default function OrdersScreen() {
  const { workspace, user, refresh } = useSession();
  const orders = workspace?.orders ?? [];

  return (
    <Screen title="Orders" subtitle={user?.business ?? user?.name} onRefresh={refresh}>
      <Button title="Refresh" icon={RefreshCw} variant="secondary" onPress={refresh} />
      {orders.length === 0 ? <EmptyState message="Your orders will appear here." icon={ReceiptText} /> : null}
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
