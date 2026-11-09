// Home tab — greeting, search entry, quick actions, trade-credit meter,
// in-progress orders and the latest orders.

import { useRouter } from '@/navigation/router';
import { Bell, ChevronRight, CreditCard, FileText, Pill, ReceiptText, Search, Truck } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { OrderCard, StageBadge } from '@/components/orders';
import { Card, colors, EmptyState, Screen, SectionLabel, Skeleton } from '@/components/ui';
import { isActive, money } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

function Tile({ icon: Icon, label, onPress }: { icon: typeof Pill; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} className="flex-1 items-center active:opacity-70">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
        <Icon size={26} color={colors.brand} />
      </View>
      <Text className="mt-2 text-center text-xs font-semibold text-ink" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function HomeSkeleton() {
  return (
    <View accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      <Skeleton height={50} radius={16} style={{ marginTop: 8 }} />
      <View className="mt-5 flex-row justify-between px-1">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="items-center" style={{ width: 72 }}>
            <Skeleton width={64} height={64} radius={18} />
            <Skeleton width={52} height={10} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
      <Card>
        <Skeleton width="40%" height={12} />
        <Skeleton width="55%" height={26} style={{ marginTop: 10 }} />
        <Skeleton height={8} radius={4} style={{ marginTop: 12 }} />
      </Card>
      <Card>
        <Skeleton width="30%" height={16} />
        <Skeleton width="60%" height={12} style={{ marginTop: 10 }} />
        <Skeleton width="45%" height={12} style={{ marginTop: 8 }} />
      </Card>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, workspace, refresh } = useSession();
  const orders = [...(workspace?.orders ?? [])].reverse();
  const inProgress = orders
    .filter((order) => isActive(order.status))
    .sort((a, b) => Number(b.status === 'out_for_delivery') - Number(a.status === 'out_for_delivery'));
  const unread = workspace?.notifications.filter((n) => !n.read).length ?? 0;
  const limit = user?.credit_limit ?? 0;
  const used = user?.credit_used ?? 0;
  const usedShare = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const first = user?.name?.split(' ')[0] ?? '';

  return (
    <Screen title={first ? `Hello, ${first}` : 'Home'} subtitle={user?.business ?? user?.name} onRefresh={refresh} loading={!workspace} skeleton={<HomeSkeleton />}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Search medicines"
        onPress={() => router.navigate('/medicines')}
        className="mt-2 flex-row items-center rounded-2xl border border-line bg-white px-3.5 py-3.5"
        style={{ elevation: 1 }}
      >
        <Search size={18} color={colors.muted} />
        <Text className="ml-2 flex-1 text-base text-[#9aa8a0]">Search medicines, brands, generics…</Text>
      </Pressable>

      <View className="mt-5 flex-row">
        <Tile icon={Pill} label="Medicines" onPress={() => router.navigate('/medicines')} />
        <Tile icon={ReceiptText} label="My orders" onPress={() => router.navigate('/orders')} />
        <Tile icon={CreditCard} label="Credit & payments" onPress={() => router.push('/finance')} />
        <Tile icon={FileText} label="Returns & records" onPress={() => router.push('/records')} />
      </View>

      {unread > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/alerts')}
          className="mt-5 flex-row items-center rounded-2xl bg-brand-accent/60 px-4 py-3 active:opacity-80"
        >
          <Bell size={18} color={colors.brand} />
          <Text className="ml-2 flex-1 text-[15px] font-semibold text-brand">
            {unread} new {unread === 1 ? 'update' : 'updates'} on your orders
          </Text>
          <ChevronRight size={18} color={colors.brand} />
        </Pressable>
      ) : null}

      <Card>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <CreditCard size={16} color={colors.muted} />
            <Text className="ml-1.5 text-sm font-bold text-muted">Available trade credit</Text>
          </View>
          <Text className="text-xs font-semibold text-muted">{usedShare}% used</Text>
        </View>
        <Text className="mt-1 text-[27px] font-bold text-ink">{money(Math.max(0, limit - used))}</Text>
        <View className="mt-2 h-2 overflow-hidden rounded-full bg-brand-soft">
          <View className="h-2 rounded-full bg-brand" style={{ width: `${usedShare}%` }} />
        </View>
        <Text className="mt-2 text-[13px] text-muted">
          Limit {money(limit)} · Used {money(used)}
        </Text>
      </Card>

      {inProgress.length > 0 ? (
        <>
          <SectionLabel>In progress</SectionLabel>
          {inProgress.slice(0, 2).map((order) => (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
              className="mt-2.5 flex-row items-center rounded-2xl bg-brand px-4 py-4 active:opacity-90"
            >
              <View className="h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                <Truck size={22} color="#fff" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-white">{order.number}</Text>
                <StageBadge status={order.status} />
              </View>
              <Text className="text-base font-bold text-white">{money(order.total)}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      <SectionLabel>Recent orders</SectionLabel>
      {orders.length === 0 ? (
        <EmptyState message="No orders yet. Your first order will show up here." icon={ReceiptText} />
      ) : null}
      {orders.slice(0, 3).map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </Screen>
  );
}
