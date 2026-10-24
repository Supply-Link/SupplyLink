import { useRouter } from 'expo-router';
import { Bell, CreditCard, LayoutGrid, Pill, RefreshCw } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { OrderCard } from '@/components/orders';
import { Button, Card, colors, EmptyState, Muted, Screen, SectionLabel } from '@/components/ui';
import { APP } from '@/lib/config';
import { isActive, money } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { user, workspace, refresh } = useSession();
  const orders = workspace?.orders ?? [];
  const active = orders.filter((order) => isActive(order.status)).length;
  const unread = workspace?.notifications.filter((n) => !n.read).length ?? 0;
  const limit = user?.credit_limit ?? 0;
  const used = user?.credit_used ?? 0;

  return (
    <Screen title="Home" subtitle={user?.business ?? user?.name} onRefresh={refresh}>
      <Text className="mt-2 text-2xl font-bold text-ink">Hello, {user?.name.split(' ')[0]}</Text>
      <Muted className="text-[15px]">{APP.greeting}</Muted>

      <Card>
        <View className="flex-row items-center">
          <LayoutGrid size={22} color={colors.brand} />
          <Text className="ml-2 text-[23px] font-bold text-ink">{active} active orders</Text>
        </View>
        <Muted>{orders.length} total · Updated from your server</Muted>
      </Card>

      <Card>
        <View className="flex-row items-center">
          <CreditCard size={16} color={colors.muted} />
          <Text className="ml-1.5 text-sm font-bold text-muted">Available trade credit</Text>
        </View>
        <Text className="mt-1 text-[25px] font-bold text-ink">{money(Math.max(0, limit - used))}</Text>
        <Muted>
          Limit {money(limit)} · Used {money(used)}
        </Muted>
      </Card>

      <Button title="Browse medicines" icon={Pill} onPress={() => router.navigate('/medicines')} />
      <Button title="Refresh workspace" icon={RefreshCw} variant="secondary" onPress={refresh} />
      <Button
        title={unread > 0 ? `Notifications (${unread} new)` : 'Notifications'}
        icon={Bell}
        variant="secondary"
        onPress={() => router.push('/alerts')}
      />

      <SectionLabel>Recent orders</SectionLabel>
      {orders.length === 0 ? <EmptyState message="No orders yet." /> : null}
      {orders.slice(0, 3).map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
