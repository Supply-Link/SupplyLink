// Home tab — today's summary, the delivery to do next, quick links and recent deliveries.

import { useRouter } from '@/navigation/router';
import { Bell, CheckCircle2, ChevronRight, MapPin, Truck } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { OrderCard, StageBadge } from '@/components/orders';
import { Card, colors, EmptyState, Screen, SectionLabel, Skeleton } from '@/components/ui';
import { isActive, money } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

function Stat({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="mr-3 flex-1 rounded-2xl bg-white px-4 py-4 active:opacity-80" style={{ elevation: 2 }}>
      <Text className="text-[30px] font-bold text-ink">{value}</Text>
      <Text className="text-[13px] font-semibold text-muted">{label}</Text>
    </Pressable>
  );
}

function HomeSkeleton() {
  return (
    <View accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      <View className="mt-3 flex-row">
        <Skeleton height={84} radius={16} style={{ flex: 1, marginRight: 12 }} />
        <Skeleton height={84} radius={16} style={{ flex: 1 }} />
      </View>
      <Card>
        <Skeleton width="35%" height={12} />
        <Skeleton width="60%" height={20} style={{ marginTop: 10 }} />
        <Skeleton width="80%" height={12} style={{ marginTop: 10 }} />
      </Card>
      <Card>
        <Skeleton width="50%" height={16} />
        <Skeleton width="70%" height={12} style={{ marginTop: 10 }} />
      </Card>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, workspace, refresh } = useSession();
  const orders = [...(workspace?.orders ?? [])].reverse();
  const active = orders.filter((order) => isActive(order.status));
  const done = orders.length - active.length;
  const unread = workspace?.notifications.filter((n) => !n.read).length ?? 0;
  const next = active.find((o) => o.status === 'out_for_delivery') ?? active[0];
  const first = user?.name?.split(' ')[0] ?? '';

  return (
    <Screen
      title={first ? `Hello, ${first}` : 'Home'}
      subtitle={user?.business ?? user?.name}
      onRefresh={refresh}
      loading={!workspace}
      skeleton={<HomeSkeleton />}
    >
      <View className="mt-3 flex-row">
        <Stat value={active.length} label="To deliver" onPress={() => router.navigate('/deliveries')} />
        <Stat value={done} label="Completed" onPress={() => router.navigate('/deliveries')} />
      </View>

      {unread > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/alerts')}
          className="mt-4 flex-row items-center rounded-2xl bg-brand-accent/60 px-4 py-3 active:opacity-80"
        >
          <Bell size={18} color={colors.brand} />
          <Text className="ml-2 flex-1 text-[15px] font-semibold text-brand">
            {unread} new {unread === 1 ? 'alert' : 'alerts'}
          </Text>
          <ChevronRight size={18} color={colors.brand} />
        </Pressable>
      ) : null}

      <SectionLabel>Next delivery</SectionLabel>
      {next ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/order/[id]', params: { id: next.id } })}
          className="mt-2.5 rounded-2xl bg-brand px-4 py-4 active:opacity-90"
        >
          <View className="flex-row items-center">
            <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <Truck size={22} color="#fff" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-base font-bold text-white">{next.number}</Text>
              <StageBadge status={next.status} />
            </View>
            <Text className="text-base font-bold text-white">{money(next.total)}</Text>
          </View>
          <View className="mt-3 flex-row items-start">
            <MapPin size={16} color="#c0d0c0" style={{ marginTop: 2 }} />
            <Text className="ml-2 flex-1 text-[14px] leading-5 text-brand-mist">
              {next.retailer_name} · {next.address}
            </Text>
          </View>
        </Pressable>
      ) : (
        <EmptyState message="You're all caught up. New deliveries will appear here." icon={CheckCircle2} />
      )}

      <SectionLabel>Recent deliveries</SectionLabel>
      {orders.length <= 1 && next ? <Text className="mt-2 text-[13px] text-muted">Other deliveries will show up here.</Text> : null}
      {orders.length === 0 ? <EmptyState message="No deliveries have been assigned to you yet." icon={Truck} /> : null}
      {orders.filter((o) => o.id !== next?.id).slice(0, 3).map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
