// Deliveries tab — assigned deliveries, split into what is left to do and what is done.

import { Truck } from 'lucide-react-native';
import { useState } from 'react';
import { OrderCard } from '@/components/orders';
import { Chips, EmptyState, Screen } from '@/components/ui';
import { isActive } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

type Filter = 'active' | 'done' | 'all';

const OPTIONS: { value: Filter; label: string }[] = [
  { value: 'active', label: 'To deliver' },
  { value: 'done', label: 'Completed' },
  { value: 'all', label: 'All' },
];

export default function DeliveriesScreen() {
  const { workspace, user, refresh } = useSession();
  const [filter, setFilter] = useState<Filter>('active');
  const orders = [...(workspace?.orders ?? [])].reverse().filter((o) => {
    if (filter === 'all') return true;
    return filter === 'active' ? isActive(o.status) : !isActive(o.status);
  });

  return (
    <Screen title="Deliveries" subtitle={user?.business ?? user?.name} onRefresh={refresh} loading={!workspace}>
      <Chips value={filter} onChange={setFilter} options={OPTIONS} />
      {orders.length === 0 ? (
        <EmptyState
          message={filter === 'active' ? 'Nothing left to deliver right now.' : 'No deliveries in this view.'}
          icon={Truck}
        />
      ) : null}
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
