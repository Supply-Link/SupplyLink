import { Tabs } from 'expo-router';
import { House, Pill, ReceiptText, ShoppingBasket, UserRound } from 'lucide-react-native';
import { colors } from '@/components/ui';
import { useCart } from '@/session/CartProvider';

export default function TabLayout() {
  const { count } = useCart();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: '#dfe7df' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="medicines" options={{ title: 'Medicines', tabBarIcon: ({ color, size }) => <Pill color={color} size={size} /> }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }} />
      <Tabs.Screen
        name="basket"
        options={{
          title: 'Basket',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.brand },
          tabBarIcon: ({ color, size }) => <ShoppingBasket color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs>
  );
}
