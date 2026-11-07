// TabNavigator — bottom tabs: Home, Deliveries (active-count badge),
// Alerts (unread badge), and Account.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Bell, House, Truck, UserRound } from 'lucide-react-native';
import { colors } from '@/components/ui';
import HomeScreen from '@/app/(tabs)/index';
import DeliveriesScreen from '@/app/(tabs)/deliveries';
import AlertsScreen from '@/app/(tabs)/alerts';
import AccountScreen from '@/app/(tabs)/account';
import { isActive } from '@/lib/rules';
import { useSession } from '@/session/SessionProvider';

const Tabs = createBottomTabNavigator();

export default function TabNavigator() {
  const { workspace } = useSession();
  const active = workspace?.orders.filter((order) => isActive(order.status)).length ?? 0;
  const unread = workspace?.notifications.filter((notification) => !notification.read).length ?? 0;

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: '#e5e8e3' },
        tabBarBadgeStyle: { backgroundColor: colors.brand },
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="Deliveries" component={DeliveriesScreen} options={{ title: 'Deliveries', tabBarBadge: active > 0 ? active : undefined, tabBarIcon: ({ color, size }) => <Truck color={color} size={size} /> }} />
      <Tabs.Screen name="Alerts" component={AlertsScreen} options={{ title: 'Alerts', tabBarBadge: unread > 0 ? unread : undefined, tabBarIcon: ({ color, size }) => <Bell color={color} size={size} /> }} />
      <Tabs.Screen name="Account" component={AccountScreen} options={{ title: 'Account', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs.Navigator>
  );
}
