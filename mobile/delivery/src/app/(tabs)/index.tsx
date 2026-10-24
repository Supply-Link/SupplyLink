import { useRouter } from 'expo-router';
import { Bell, LayoutGrid, RefreshCw, Truck } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { OrderCard } from '@/components/orders';
import { Button, Card, colors, EmptyState, Muted, Screen, SectionLabel } from '@/components/ui';
import { APP } from '@/lib/config';
import { isActive } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function HomeScreen() {
  const router = useRouter();
  const { user, workspace, refresh } = useSession();
  const orders = workspace?.orders ?? [];
  const active = orders.filter((order) => isActive(order.status)).length;

  return (
    <Screen title="Home" subtitle={user?.business ?? user?.name} onRefresh={refresh}>
      <Text className="mt-2 text-2xl font-bold text-ink">Hello, {user?.name.split(' ')[0]}</Text>
      <Muted className="text-[15px]">{APP.greeting}</Muted>

      <Card>
        <View className="flex-row items-center">
          <LayoutGrid size={22} color={colors.brand} />
          <Text className="ml-2 text-[23px] font-bold text-ink">{active} active deliveries</Text>
        </View>
        <Muted>{orders.length} total · Updated from your server</Muted>
      </Card>

      <Button title="View assigned deliveries" icon={Truck} onPress={() => router.navigate('/deliveries')} />
      <Button title="Refresh workspace" icon={RefreshCw} variant="secondary" onPress={refresh} />
      <Button title="Notifications" icon={Bell} variant="secondary" onPress={() => router.navigate('/alerts')} />

      <SectionLabel>Recent deliveries</SectionLabel>
      {orders.length === 0 ? <EmptyState message="No deliveries have been assigned to you." /> : null}
      {orders.slice(0, 3).map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
