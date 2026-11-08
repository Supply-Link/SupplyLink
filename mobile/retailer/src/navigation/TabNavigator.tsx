// TabNavigator — bottom tabs: Home, Medicines, Orders,
// Basket (cart-count badge), and Account.

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, Pill, ReceiptText, ShoppingBasket, UserRound } from 'lucide-react-native';
import { colors } from '@/components/ui';
import HomeScreen from '@/app/(tabs)/index';
import MedicinesScreen from '@/app/(tabs)/medicines';
import OrdersScreen from '@/app/(tabs)/orders';
import BasketScreen from '@/app/(tabs)/basket';
import AccountScreen from '@/app/(tabs)/account';
import { useCart } from '@/session/CartProvider';

const Tabs = createBottomTabNavigator();

export default function TabNavigator() {
  const { count } = useCart();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: '#e5e8e3' },
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="Medicines" component={MedicinesScreen} options={{ title: 'Medicines', tabBarIcon: ({ color, size }) => <Pill color={color} size={size} /> }} />
      <Tabs.Screen name="Orders" component={OrdersScreen} options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size} /> }} />
      <Tabs.Screen name="Basket" component={BasketScreen} options={{ title: 'Basket', tabBarBadge: count > 0 ? count : undefined, tabBarBadgeStyle: { backgroundColor: colors.brand }, tabBarIcon: ({ color, size }) => <ShoppingBasket color={color} size={size} /> }} />
      <Tabs.Screen name="Account" component={AccountScreen} options={{ title: 'Account', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
    </Tabs.Navigator>
  );
}
