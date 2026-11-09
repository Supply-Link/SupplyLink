// Orders tab — newest-first order list with status filters.

import { ReceiptText } from 'lucide-react-native';
import { useState } from 'react';
import { OrderCard } from '@/components/orders';
import { Chips, EmptyState, Screen } from '@/components/ui';
import { isActive } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

type Filter = 'all' | 'active' | 'delivered' | 'cancelled';

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersScreen() {
  const { workspace, user, refresh } = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const orders = [...(workspace?.orders ?? [])].reverse().filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'active') return isActive(order.status);
    return order.status === filter;
  });

  return (
    <Screen title="Orders" subtitle={user?.business ?? user?.name} onRefresh={refresh} loading={!workspace}>
      <Chips value={filter} onChange={setFilter} options={OPTIONS} />
      {orders.length === 0 ? (
        <EmptyState
          message={filter === 'all' ? 'Your orders will appear here.' : 'No orders in this view.'}
          icon={ReceiptText}
        />
      ) : null}
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
