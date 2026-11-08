// Deliveries tab — list of all assigned delivery orders
// with live status badges.

import { RefreshCw, Truck } from 'lucide-react-native';
import { OrderCard } from '@/components/orders';
import { Button, EmptyState, Screen } from '@/components/ui';
import { useSession } from '@/session/SessionProvider';

export default function DeliveriesScreen() {
  const { workspace, user, refresh } = useSession();
  const orders = workspace?.orders ?? [];

  return (
    <Screen title="Deliveries" subtitle={user?.business ?? user?.name} onRefresh={refresh}>
      <Button title="Refresh" icon={RefreshCw} variant="secondary" onPress={refresh} />
      {orders.length === 0 ? <EmptyState message="No deliveries have been assigned to you." icon={Truck} /> : null}
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
