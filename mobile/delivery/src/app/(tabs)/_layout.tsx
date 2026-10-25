import { Tabs } from 'expo-router';
import { Bell, House, Truck, UserRound } from 'lucide-react-native';
import { colors } from '@/components/ui';
import { isActive } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

export default function TabLayout() {
  const { workspace } = useSession();
  const active = workspace?.orders.filter((o) => isActive(o.status)).length ?? 0;
  const unread = workspace?.notifications.filter((n) => !n.read).length ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: '#e5e8e3' },
        tabBarBadgeStyle: { backgroundColor: colors.brand },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Deliveries',
          tabBarBadge: active > 0 ? active : undefined,
          tabBarIcon: ({ color, size }) => <Truck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
